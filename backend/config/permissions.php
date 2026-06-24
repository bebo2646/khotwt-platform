<?php

return [
    'groups' => [
        'users_management' => 'إدارة المستخدمين',
        'students_management' => 'إدارة الطلاب',
        'teachers_management' => 'إدارة المعلمين',
        'courses_management' => 'إدارة الكورسات والمحتوى',
        'exams_management' => 'إدارة الاختبارات والواجبات',
        'notifications' => 'الإشعارات الجماعية',
        'wallet_payments' => 'المحفظة والمدفوعات',
        'subscription_management' => 'إدارة الاشتراكات والخطط',
        'promo_codes' => 'أكواد الشحن والخصومات',
        'reports_analytics' => 'التقارير والإحصائيات',
        'admin_management' => 'إدارة المشرفين والمدراء',
        'permissions_management' => 'إدارة الصلاحيات والوصول',
        'content_management' => 'إدارة المحتوى الدراسي',
        'video_management' => 'إدارة مكتبة الفيديو',
        'system_settings' => 'إعدادات النظام العامة',
    ],
    'permissions' => [
        // Users Management
        'users.view' => [
            'group' => 'users_management',
            'label' => 'عرض المستخدمين',
        ],
        'users.create' => [
            'group' => 'users_management',
            'label' => 'إضافة مستخدمين',
        ],
        'users.edit' => [
            'group' => 'users_management',
            'label' => 'تعديل مستخدمين',
        ],
        'users.delete' => [
            'group' => 'users_management',
            'label' => 'حذف مستخدمين',
        ],
        // Students Management
        'students.manage' => [
            'group' => 'students_management',
            'label' => 'إدارة الطلاب كاملة',
        ],
        'students.view' => [
            'group' => 'students_management',
            'label' => 'عرض بيانات الطلاب',
        ],
        'students.delete' => [
            'group' => 'students_management',
            'label' => 'حذف حسابات الطلاب',
        ],
        // Teachers Management
        'teachers.manage' => [
            'group' => 'teachers_management',
            'label' => 'إدارة المعلمين كاملة',
        ],
        // Courses Management
        'courses.manage' => [
            'group' => 'courses_management',
            'label' => 'إدارة الكورسات والباقات',
        ],
        // Exams Management
        'exams.manage' => [
            'group' => 'exams_management',
            'label' => 'إدارة الامتحانات والواجبات والأسئلة',
        ],
        // Notifications
        'notifications.send' => [
            'group' => 'notifications',
            'label' => 'إرسال الإشعارات الجماعية',
        ],
        // Wallet & Payments
        'wallet.manage' => [
            'group' => 'wallet_payments',
            'label' => 'إدارة المحفظة وشحن الأرصدة',
        ],
        // Subscription Management
        'subscriptions.manage' => [
            'group' => 'subscription_management',
            'label' => 'إدارة اشتراكات المعلمين والخطط',
        ],
        // Promo Codes
        'coupons.manage' => [
            'group' => 'promo_codes',
            'label' => 'إدارة أكواد الشحن والتفعيل',
        ],
        // Reports & Analytics
        'reports.view' => [
            'group' => 'reports_analytics',
            'label' => 'عرض التقارير والتحليلات المالية والتعليمية',
        ],
        // Admin Management
        'admins.manage' => [
            'group' => 'admin_management',
            'label' => 'إدارة حسابات المشرفين',
        ],
        // Permissions Management
        'permissions.manage' => [
            'group' => 'permissions_management',
            'label' => 'إدارة صلاحيات المشرفين وتوزيعها',
        ],
        // Content Management
        'content.manage' => [
            'group' => 'content_management',
            'label' => 'إدارة الدروس والوحدات والملفات',
        ],
        // Video Management
        'videos.manage' => [
            'group' => 'video_management',
            'label' => 'إدارة الفيديوهات وبوابات البث',
        ],
        // System Settings
        'settings.manage' => [
            'group' => 'system_settings',
            'label' => 'تعديل إعدادات النظام وتهيئة السنوات الدراسية',
        ],
    ]
];
