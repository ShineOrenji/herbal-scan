<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HerbBotMessage extends Model
{
    protected $table = 'herbbot_messages';

    protected $guarded = ['id'];

    public function session(): BelongsTo
    {
        return $this->belongsTo(HerbBotSession::class, 'session_id');
    }
}
