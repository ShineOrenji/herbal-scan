<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('herbals', function (Blueprint $table) {
            if (!Schema::hasColumn('herbals', 'preparation_method')) {
                $table->text('preparation_method')->nullable()->after('traditional_usage');
            }
            if (!Schema::hasColumn('herbals', 'dosage_notes')) {
                $table->text('dosage_notes')->nullable()->after('preparation_method');
            }
            if (!Schema::hasColumn('herbals', 'contraindications')) {
                $table->text('contraindications')->nullable()->after('dosage_notes');
            }
            if (!Schema::hasColumn('herbals', 'scientific_reference')) {
                $table->string('scientific_reference', 255)->nullable()->after('contraindications');
            }
        });
    }

    public function down(): void
    {
        Schema::table('herbals', function (Blueprint $table) {
            $cols = array_filter([
                Schema::hasColumn('herbals', 'preparation_method') ? 'preparation_method' : null,
                Schema::hasColumn('herbals', 'dosage_notes') ? 'dosage_notes' : null,
                Schema::hasColumn('herbals', 'contraindications') ? 'contraindications' : null,
                Schema::hasColumn('herbals', 'scientific_reference') ? 'scientific_reference' : null,
            ]);
            if (!empty($cols)) {
                $table->dropColumn($cols);
            }
        });
    }
};
