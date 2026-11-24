<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ScanHistory extends Model
{
    protected $fillable = [
        'user_id',
        'detected_slug',
        'confidence_score',
        'image_path',
    ];

    protected $appends = ['image_url'];

    public function herbal(): BelongsTo
    {
        return $this->belongsTo(Herbal::class, 'detected_slug', 'slug');
    }

    public function getImageUrlAttribute(): ?string
    {
        if (empty($this->image_path)) {
            return null;
        }

        if (str_starts_with($this->image_path, 'http://') || str_starts_with($this->image_path, 'https://')) {
            return $this->image_path;
        }

        return asset('storage/' . ltrim($this->image_path, '/'));
    }
}