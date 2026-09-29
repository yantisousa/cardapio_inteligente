<?php

namespace Tests\Unit;

use App\Support\PixKey;
use PHPUnit\Framework\TestCase;

class PixKeyTest extends TestCase
{
    public function test_it_normalizes_a_brazilian_phone_key_to_e164(): void
    {
        $this->assertSame('+5585996479539', PixKey::normalize('85996479539'));
        $this->assertSame('+5585996479539', PixKey::normalize('(85) 99647-9539'));
    }

    public function test_it_preserves_other_pix_key_types(): void
    {
        $this->assertSame('12345678909', PixKey::normalize('123.456.789-09'));
        $this->assertSame('financeiro@example.com', PixKey::normalize('financeiro@example.com'));
        $this->assertSame('123e4567-e12b-12d1-a456-426655440000', PixKey::normalize('123e4567-e12b-12d1-a456-426655440000'));
    }
}
