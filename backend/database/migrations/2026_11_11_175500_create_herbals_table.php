<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('herbals', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique(); // contoh: 'sirih', 'lidah_buaya'
            $table->string('name');
            $table->string('scientific_name');
            $table->string('local_name');
            $table->text('description');
            $table->string('plant_parts_used');
            $table->text('traditional_usage');
            $table->text('lab_evidence')->nullable();     // Bukti Penelitian Laboratorium
            $table->text('clinical_evidence')->nullable();// Bukti Uji Klinis Manusia
            $table->text('safety_warning');               // Peringatan Keamanan & Kontraindikasi
            $table->string('image_url')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('herbals');
    }
};