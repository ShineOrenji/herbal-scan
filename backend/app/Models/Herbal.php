<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Herbal extends Model
{
    protected $appends = ['is_toxic'];

    protected $guarded = ['id'];

    public function references(): HasMany
    {
        return $this->hasMany(ScientificReference::class, 'herbal_id');
    }

    public function getIsToxicAttribute(): bool
    {
        $s = strtolower((string) ($this->attributes['scientific_name'] ?? ''));
        $n = strtolower((string) ($this->attributes['name'] ?? ''));
        if ((str_starts_with($s, 'vitis ') || str_contains($n, 'anggur') || str_contains($n, 'grape')) && !str_contains($s, 'menispermum') && !str_contains($s, 'parthenocissus')) {
            return false;
        }
        if (!empty($this->attributes['is_toxic'])) {
            return true;
        }

        $haystack = strtolower(trim(
            ($this->attributes['name'] ?? '') . ' ' .
            ($this->attributes['scientific_name'] ?? '') . ' ' .
            ($this->attributes['local_name'] ?? '') . ' ' .
            ($this->attributes['safety_warning'] ?? '')
        ));

        $toxicPatterns = [
            'beracun', 'toksik', 'peringatan tanaman beracun',
            'phytolacca', 'pokeweed',
            'abrus precatorius', 'saga rambat', 'saga telik',
            'datura', 'kecubung',
            'brugmansia', 'bunga terompet',
            'ricinus communis', 'jarak kepyar', 'jarak kaliki',
            'jatropha', 'jarak pagar', 'jarak tintir',
            'nerium oleander', 'oleander',
            'cerbera', 'bintaro',
            'dioscorea hispida', 'gadung',
            'euphorbia tirucalli', 'patah tulang',
            'catharanthus roseus', 'tapak dara',
            'lantana camara', 'tembelekan',
            'dieffenbachia', 'sri rejeki',
            'strychnos', 'bidara laut',
            'atropa', 'belladonna',
            'conium', 'hemlock',
            'aconitum', 'digitalis',
            'thevetia', 'ginje',
            'excoecaria agallocha', 'buta-buta',
            'antiaris toxicaria', 'upas',
        ];

        foreach ($toxicPatterns as $pattern) {
            if (str_contains($haystack, $pattern)) {
                return true;
            }
        }

        return false;
    }
}
