<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

use Illuminate\Database\Eloquent\Attributes\Fillable;

#[Fillable([
    'key',
    'group_key',
    'group_label',
    'label_ar',
])]
class Permission extends Model
{
    //
}
