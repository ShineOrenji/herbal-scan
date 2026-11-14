<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Herbal extends Model
{
    protected $guarded = ['id'];

    public function references(): HasMany
    {
        return $this->hasMany(ScientificReference::class, 'herbal_id');
    }
}
