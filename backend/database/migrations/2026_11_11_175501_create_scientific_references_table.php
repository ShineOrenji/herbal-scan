<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('scientific_references', function (Blueprint $table) {
            $table->id();
            $table->foreignId('herbal_id')->constrained('herbals')->onDelete('cascade');
            $table->string('title');
            $table->string('author_year');
            $table->enum('evidence_level', ['Tradisional', 'Laboratorium', 'Uji Klinis']);
            $table->string('doi_or_url')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('scientific_references');
    }
};