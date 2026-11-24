<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'phone')) {
                $table->string('phone', 25)->nullable()->unique()->after('email');
            }
            if (!Schema::hasColumn('users', 'avatar_path')) {
                $table->string('avatar_path')->nullable()->after('password');
            }
            if (!Schema::hasColumn('users', 'google_id')) {
                $table->string('google_id')->nullable()->unique()->after('avatar_path');
            }
            if (!Schema::hasColumn('users', 'has_password')) {
                $table->boolean('has_password')->default(true)->after('google_id');
            }
            $table->string('password')->nullable()->change();
        });

        if (!Schema::hasTable('email_otps')) {
            Schema::create('email_otps', function (Blueprint $table) {
                $table->id();
                $table->string('email')->index();
                $table->string('otp_code', 6);
                $table->json('payload')->nullable();
                $table->timestamp('expires_at');
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('email_otps');

        Schema::table('users', function (Blueprint $table) {
            $cols = array_filter(
                ['phone', 'avatar_path', 'google_id', 'has_password'],
                fn ($col) => Schema::hasColumn('users', $col)
            );
            if (!empty($cols)) {
                $table->dropColumn($cols);
            }
        });
    }
};