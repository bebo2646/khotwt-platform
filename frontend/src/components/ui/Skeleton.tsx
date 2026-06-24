import React from 'react'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-slate-200/50 dark:bg-slate-850/50 rounded-xl before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 dark:before:via-white/5 before:to-transparent ${className}`} />
  )
}

export function DashboardSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12" dir="rtl">
      {/* Hero Banner Skeleton */}
      <div className="h-64 rounded-3xl bg-slate-100/50 dark:bg-slate-900/40 border border-border-color p-8 flex flex-col justify-between animate-pulse">
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-10 w-96" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-12 w-64 rounded-2xl" />
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-6 bg-slate-100/50 dark:bg-slate-900/40 rounded-3xl border border-border-color flex justify-between items-center">
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-12" />
            </div>
            <Skeleton className="h-12 w-12 rounded-2xl" />
          </div>
        ))}
      </div>

      {/* Grid Sections Skeleton */}
      <div className="space-y-6">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-slate-100/50 dark:bg-slate-900/40 rounded-3xl border border-border-color overflow-hidden flex flex-col justify-between h-[380px]">
              <Skeleton className="aspect-video w-full rounded-none" />
              <div className="p-6 space-y-4 flex-grow">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-full" />
              </div>
              <div className="p-6 pt-0 flex justify-between items-center">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-10 w-32 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function CoursesSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-10 space-y-8" dir="rtl">
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-slate-100/50 dark:bg-slate-900/40 rounded-3xl border border-border-color overflow-hidden flex flex-col justify-between h-[380px]">
            <Skeleton className="aspect-video w-full rounded-none" />
            <div className="p-6 space-y-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full" />
            </div>
            <div className="p-6 pt-0 flex justify-between items-center">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-10 w-32 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ExamSkeleton() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between" dir="rtl">
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3.5 w-24" />
          </div>
        </div>
        <Skeleton className="h-10 w-24 rounded-2xl" />
      </div>
      <div className="flex-grow max-w-7xl w-full mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-full" />
          </div>
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl space-y-8 min-h-[300px] flex flex-col justify-between">
            <div className="space-y-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-8 w-3/4" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-2xl" />
            </div>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4 h-64">
          <Skeleton className="h-5 w-32" />
          <div className="grid grid-cols-5 gap-2.5 pt-2">
            {[...Array(15)].map((_, i) => (
              <Skeleton key={i} className="h-9 w-9 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
      <div className="bg-slate-900 border-t border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex gap-3">
          <Skeleton className="h-10 w-24 rounded-xl" />
          <Skeleton className="h-10 w-24 rounded-xl" />
        </div>
        <Skeleton className="h-10 w-40 rounded-xl" />
      </div>
    </div>
  )
}
