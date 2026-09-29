<?php

namespace Tests\Unit;

use App\Models\TenantSetting;
use App\Services\StoreAvailabilityService;
use Carbon\CarbonImmutable;
use PHPUnit\Framework\TestCase;

class StoreAvailabilityServiceTest extends TestCase
{
    public function test_it_reports_open_closed_scheduled_and_paused_states(): void
    {
        $service = new StoreAvailabilityService;
        $settings = new TenantSetting([
            'enforce_business_hours' => true,
            'outside_hours_mode' => 'block',
            'business_hours' => [
                'timezone' => 'America/Sao_Paulo',
                'schedule' => ['monday' => [['open' => '18:00', 'close' => '23:00']]],
            ],
        ]);

        $open = $service->status($settings, CarbonImmutable::parse('2026-09-28 19:00:00', 'America/Sao_Paulo'));
        $this->assertSame('open', $open['state']);
        $this->assertTrue($open['accepting_orders']);

        $closed = $service->status($settings, CarbonImmutable::parse('2026-09-28 10:00:00', 'America/Sao_Paulo'));
        $this->assertSame('closed', $closed['state']);
        $this->assertFalse($closed['accepting_orders']);

        $settings->outside_hours_mode = 'schedule';
        $scheduled = $service->status($settings, CarbonImmutable::parse('2026-09-28 10:00:00', 'America/Sao_Paulo'));
        $this->assertSame('scheduled', $scheduled['state']);
        $this->assertTrue($scheduled['will_schedule']);
        $this->assertStringContainsString('2026-09-28T18:00:00', $scheduled['scheduled_for']);

        $settings->is_paused = true;
        $settings->pause_message = 'Voltamos em instantes.';
        $paused = $service->status($settings, CarbonImmutable::parse('2026-09-28 19:00:00', 'America/Sao_Paulo'));
        $this->assertSame('paused', $paused['state']);
        $this->assertFalse($paused['accepting_orders']);
        $this->assertSame('Voltamos em instantes.', $paused['message']);
    }
}
