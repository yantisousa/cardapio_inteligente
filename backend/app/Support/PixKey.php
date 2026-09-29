<?php

namespace App\Support;

class PixKey
{
    public static function normalize(?string $key): ?string
    {
        $key = trim((string) $key);
        if ($key === '') {
            return null;
        }

        $digits = preg_replace('/\D+/', '', $key) ?? '';

        if (str_starts_with($key, '+')) {
            return '+'.$digits;
        }

        if (strlen($digits) === 11) {
            $looksFormattedAsPhone = str_contains($key, '(') || str_contains($key, ')');

            return $looksFormattedAsPhone || ! self::isValidCpf($digits)
                ? '+55'.$digits
                : $digits;
        }

        if (strlen($digits) === 14 && preg_match('/^[\d.\/\-]+$/', $key) === 1) {
            return $digits;
        }

        return $key;
    }

    private static function isValidCpf(string $digits): bool
    {
        if (preg_match('/^(\d)\1{10}$/', $digits) === 1) {
            return false;
        }

        for ($length = 9; $length <= 10; $length++) {
            $sum = 0;
            for ($index = 0; $index < $length; $index++) {
                $sum += ((int) $digits[$index]) * (($length + 1) - $index);
            }
            $checkDigit = ($sum * 10) % 11;
            if ($checkDigit === 10) {
                $checkDigit = 0;
            }
            if ($checkDigit !== (int) $digits[$length]) {
                return false;
            }
        }

        return true;
    }
}
