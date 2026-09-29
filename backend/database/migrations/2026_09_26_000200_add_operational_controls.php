<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->boolean('is_sold_out')->default(false)->after('active');
        });

        Schema::table('tenant_settings', function (Blueprint $table) {
            $table->boolean('is_paused')->default(false)->after('accepts_pickup');
            $table->string('pause_message', 240)->nullable()->after('is_paused');
            $table->boolean('enforce_business_hours')->default(false)->after('pause_message');
            $table->string('outside_hours_mode', 20)->default('block')->after('enforce_business_hours');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->timestamp('scheduled_for')->nullable()->after('placed_at');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn('scheduled_for');
        });

        Schema::table('tenant_settings', function (Blueprint $table) {
            $table->dropColumn(['is_paused', 'pause_message', 'enforce_business_hours', 'outside_hours_mode']);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('is_sold_out');
        });
    }
};
