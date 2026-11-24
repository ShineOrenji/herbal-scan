<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('herbals', function (Blueprint $table) {
            $table->boolean('is_curated')->default(false)->after('image_url');
        });

        // Tandai data bawaan seeder yang sudah ada sebagai katalog utama Beranda
        DB::table('herbals')->update(['is_curated' => true]);
    }

    public function down(): void
    {
        Schema::table('herbals', function (Blueprint $table) {
            $table->dropColumn('is_curated');
        });
    }
};