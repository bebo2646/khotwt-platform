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
        // Dashboard
        'dashboard.view' => [
            'group' => 'system_settings',
            'label' => 'عرض لوحة التحكم العامة',
        ],
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
        'students.pending' => [
            'group' => 'students_management',
            'label' => 'مراجعة وقبول الطلاب الجدد',
        ],
        'watch_limits.manage' => [
            'group' => 'students_management',
            'label' => 'تعديل حدود مشاهدات الطلاب',
        ],
        'watch_limits.reset' => [
            'group' => 'students_management',
            'label' => 'إعادة تعيين حدود مشاهدات الطلاب',
        ],
        // Teachers Management
        'teachers.manage' => [
            'group' => 'teachers_management',
            'label' => 'إدارة المعلمين كاملة',
        ],
        // Teacher Subscriptions
        'teacher_subscriptions.manage' => [
            'group' => 'subscription_management',
            'label' => 'إدارة اشتراكات المعلمين وتجاوز الموارد',
        ],
        // Subscription Requests
        'subscription_requests.manage' => [
            'group' => 'subscription_management',
            'label' => 'إدارة طلبات اشتراكات المعلمين',
        ],
        // Subscription Plans
        'subscription_plans.manage' => [
            'group' => 'subscription_management',
            'label' => 'إدارة خطط الاشتراك وباقات المعلمين',
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
        'exam_results.view' => [
            'group' => 'exams_management',
            'label' => 'عرض نتائج واحصائيات الامتحانات',
        ],
        'certificates.manage' => [
            'group' => 'exams_management',
            'label' => 'إدارة الشهادات للطلاب',
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
        'payouts.manage' => [
            'group' => 'wallet_payments',
            'label' => 'إدارة مستحقات ومدفوعات المعلمين',
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
            'label' => 'إدارة حسابات المشرفين وصلاحياتهم',
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
        'lessons.manage' => [
            'group' => 'content_management',
            'label' => 'إدارة المحاضرات والدروس',
        ],
        // Video Management
        'videos.manage' => [
            'group' => 'video_management',
            'label' => 'إدارة الفيديوهات وبوابات البث',
        ],
        'bunny.view' => [
            'group' => 'video_management',
            'label' => 'عرض إحصائيات مساحات تخزين Bunny',
        ],
        // System Settings
        'settings.manage' => [
            'group' => 'system_settings',
            'label' => 'تعديل إعدادات النظام المتقدمة',
        ],
        'academic_year.initialize' => [
            'group' => 'system_settings',
            'label' => 'تهيئة المنصة للسنة الدراسية الجديدة',
        ],
        'support.manage' => [
            'group' => 'system_settings',
            'label' => 'إدارة الدعم الفني وتذاكر الطلاب',
        ],
        'academic_year.reset' => [
            'group' => 'system_settings',
            'label' => 'إعادة تعيين السنة الدراسية (Academic Year Reset)',
        ],
        'bubble_sheet.manage' => [
            'group' => 'exams_management',
            'label' => 'إدارة بابل شيت والواجبات (Bubble Sheet Homework)',
        ],
        'course_curriculum.manage' => [
            'group' => 'courses_management',
            'label' => 'إدارة المنهج الدراسي للمقررات (Course Curriculum)',
        ],
        'bunny.stats' => [
            'group' => 'video_management',
            'label' => 'إحصائيات Bunny ومساحات التخزين (Bunny Statistics)',
        ],
        'platform.settings' => [
            'group' => 'system_settings',
            'label' => 'تعديل إعدادات المنصة (Platform Settings)',
        ],
        'platform.initialize' => [
            'group' => 'system_settings',
            'label' => 'تهيئة المنصة العامة (Platform Initialization)',
        ],
        'student.watch_limits' => [
            'group' => 'students_management',
            'label' => 'إدارة حدود مشاهدات الطلاب (Student Watch Limits)',
        ],
        'student.view_limits_reset' => [
            'group' => 'students_management',
            'label' => 'إعادة تعيين حدود المشاهدة (View Limit Reset)',
        ],
        'teacher.revenue' => [
            'group' => 'wallet_payments',
            'label' => 'إدارة وعرض أرباح المعلمين (Teacher Revenue)',
        ],
        'subscription.plans' => [
            'group' => 'subscription_management',
            'label' => 'إدارة خطط وباقات الاشتراك (Subscription Plans)',
        ],
        'financial.reports' => [
            'group' => 'reports_analytics',
            'label' => 'عرض التقارير المالية والتحليلات (Financial Reports)',
        ],
        'exam.scheduling' => [
            'group' => 'exams_management',
            'label' => 'إدارة جدولة الامتحانات (Exam Scheduling)',
        ],
        'homework.scheduling' => [
            'group' => 'exams_management',
            'label' => 'إدارة جدولة الواجبات (Homework Scheduling)',
        ],
        'homework.reports' => [
            'group' => 'reports_analytics',
            'label' => 'عرض تقارير واجبات الطلاب (Homework Reports)',
        ],
        'exam.reports' => [
            'group' => 'reports_analytics',
            'label' => 'عرض تقارير الامتحانات والنتائج (Exam Reports)',
        ],
        'teacher.reports' => [
            'group' => 'reports_analytics',
            'label' => 'عرض وإحصائيات تقارير المعلمين (Teacher Reports)',
        ],
        'course.details_view' => [
            'group' => 'courses_management',
            'label' => 'عرض تفاصيل وسجل الكورسات (Course Details)',
        ],
        'platform.maintenance' => [
            'group' => 'system_settings',
            'label' => 'إدارة وضع الصيانة وإغلاق المنصة (Platform Maintenance)',
        ],
        'storage.statistics' => [
            'group' => 'reports_analytics',
            'label' => 'عرض إحصائيات التخزين (Storage Statistics)',
        ],
    ]
];
