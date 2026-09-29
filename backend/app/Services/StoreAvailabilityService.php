<?php

namespace App\Services;

use App\Models\TenantSetting;
use Carbon\CarbonImmutable;

class StoreAvailabilityService
{
    private const DAYS = [1 => 'monday', 2 => 'tuesday', 3 => 'wednesday', 4 => 'thursday', 5 => 'friday', 6 => 'saturday', 7 => 'sunday'];

    public function status(TenantSetting $settings, ?CarbonImmutable $now = null): array
    {
        $timezone = $settings->business_hours['timezone'] ?? 'America/Sao_Paulo';
        $now = ($now ?? CarbonImmutable::now($timezone))->setTimezone($timezone);

        if ($settings->is_paused) {
            return [
                'state' => 'paused', 'is_open' => false, 'accepting_orders' => false,
                'will_schedule' => false, 'scheduled_for' => null,
                'message' => $settings->pause_message ?: 'A loja pausou os pedidos temporariamente.',
            ];
        }

        if (! $settings->enforce_business_hours) {
            return $this->openStatus();
        }

        $schedule = $settings->business_hours['schedule'] ?? [];
        if ($this->isOpenAt($schedule, $now)) {
            return $this->openStatus();
        }

        $nextOpening = $this->nextOpening($schedule, $now);
        $willSchedule = $settings->outside_hours_mode === 'schedule' && $nextOpening !== null;

        return [
            'state' => $willSchedule ? 'scheduled' : 'closed',
            'is_open' => false,
            'accepting_orders' => $willSchedule,
            'will_schedule' => $willSchedule,
            'scheduled_for' => $nextOpening?->toIso8601String(),
            'message' => $willSchedule
                ? 'Pedido será agendado para a próxima abertura da loja.'
                : 'A loja está fechada neste horário.',
        ];
    }

    private function openStatus(): array
    {
        return [
            'state' => 'open', 'is_open' => true, 'accepting_orders' => true,
            'will_schedule' => false, 'scheduled_for' => null, 'message' => 'Loja aberta para pedidos.',
        ];
    }

    private function isOpenAt(array $schedule, CarbonImmutable $now): bool
    {
        foreach ([0, -1] as $dayOffset) {
            $day = $now->addDays($dayOffset);
            foreach ($schedule[self::DAYS[$day->isoWeekday()]] ?? [] as $interval) {
                [$opensAt, $closesAt] = $this->intervalBounds($day, $interval);
                if ($now->betweenIncluded($opensAt, $closesAt)) {
                    return true;
                }
            }
        }

        return false;
    }

    private function nextOpening(array $schedule, CarbonImmutable $now): ?CarbonImmutable
    {
        $next = null;
        for ($offset = 0; $offset <= 7; $offset++) {
            $day = $now->addDays($offset);
            foreach ($schedule[self::DAYS[$day->isoWeekday()]] ?? [] as $interval) {
                [$opensAt] = $this->intervalBounds($day, $interval);
                if ($opensAt->lessThanOrEqualTo($now)) {
                    continue;
                }
                if (! $next || $opensAt->lessThan($next)) {
                    $next = $opensAt;
                }
            }
        }

        return $next;
    }

    private function intervalBounds(CarbonImmutable $day, array $interval): array
    {
        $opensAt = $day->startOfDay()->setTimeFromTimeString($interval['open']);
        $closesAt = $day->startOfDay()->setTimeFromTimeString($interval['close']);
        if ($closesAt->lessThanOrEqualTo($opensAt)) {
            $closesAt = $closesAt->addDay();
        }

        return [$opensAt, $closesAt];
    }
}
