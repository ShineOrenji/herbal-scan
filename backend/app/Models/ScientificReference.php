<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ScientificReference extends Model
{
    protected $guarded = ['id'];

    public function herbal(): BelongsTo
    {
        return $this->belongsTo(Herbal::class, 'herbal_id');
    }
}
