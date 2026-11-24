<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('herbbot_sessions')) {
            Schema::create('herbbot_sessions', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id')->index();
                $table->string('plant_slug', 140)->nullable()->index();
                $table->string('title', 160);
                $table->timestamps();

                $table->index(['user_id', 'plant_slug']);
            });
        }

        if (!Schema::hasTable('herbbot_messages')) {
            Schema::create('herbbot_messages', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('session_id')->index();
                $table->string('role', 20); // 'user' atau 'assistant'
                $table->text('content');
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('herbbot_messages');
        Schema::dropIfExists('herbbot_sessions');
    }
};
