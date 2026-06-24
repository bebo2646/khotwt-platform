# YouTube Player Black Screen & Playback Stability Report

## Root Cause
The video player's black screen and reloading behavior was caused by the following React lifecycle issues:
1. **Dynamic Embed URL (`src`) Updates**: 
   The player's `src` attribute was calculated inline during rendering using `getEmbedUrl(activeVideo)`. The URL included the `start={pos}` parameter (where `pos` was updated every time the video progressed). When state updates occurred (e.g. `lastPosition` or `activeVideo.progress` changes), the `src` attribute updated, causing React to reload/refresh the iframe and disrupt playback.
2. **Excessive Hook Cleanups/Recreations**: 
   The YouTube player initialization `useEffect` and query timers had `[activeVideo]` in their dependency arrays. Since `activeVideo` state is updated every time video progress is saved in the background (every 5 seconds or when paused), the `useEffect` cleanup hook triggered. This constantly destroyed the `YT.Player` instance using `ytPlayer.destroy()` and re-initialized it, resulting in player recreation, video freeze, and black screens.
3. **Stale Closures**:
   Timers and event listener callbacks closed over rendering-scoped state variables and functions, leading to stale execution values when state changes occurred.

---

## Files Changed
- [LessonViewer.tsx](file:///D:/manst%20ellem/frontend/src/pages/student/LessonViewer.tsx)

---

## Exact Fix Applied

### 1. Stable Video Embed URL State
Introduced a stable state variable `videoEmbedUrl` to store the generated URL:
```tsx
const [videoEmbedUrl, setVideoEmbedUrl] = React.useState<string>('')
```
This state is initialized exactly once when the lesson/video is first loaded (`fetchLessonData`) and whenever the active video is explicitly switched (`selectVideo`). It is not updated by progress saves, meaning the iframe `src` remains completely constant throughout playback, preventing iframe reloads.

### 2. Dependency Array Refactoring
Updated dependency arrays of the player initialization `useEffect` and update intervals to run only when the video ID (`activeVideo?.id`) or tab category (`activeTab === 'videos'`) changes:
```tsx
React.useEffect(() => {
  // YT Player initialization...
}, [activeVideo?.id, activeTab === 'videos']);
```
This ensures the player is initialized only once per video and cleanups (calls to `destroy()`) are not triggered repeatedly during playback.

### 3. Function Refs to Prevent Stale Closures
Stored progress-saving callbacks (`saveLessonProgress` and `syncProgressToDb`) in refs:
```tsx
const saveLessonProgressRef = React.useRef(saveLessonProgress)
React.useEffect(() => { saveLessonProgressRef.current = saveLessonProgress }, [saveLessonProgress])

const syncProgressToDbRef = React.useRef(syncProgressToDb)
React.useEffect(() => { syncProgressToDbRef.current = syncProgressToDb }, [syncProgressToDb])
```
This allows timer intervals and player events to safely invoke the latest progression handlers without trigger-happy dependencies on the parent effects.

### 4. Background Progress Saving with Zero Player Rerenders
Progress is persisted smoothly in the background while the state update doesn't touch the player's DOM element since its `src` and wrapper elements are stable and preserved.

### 5. Detailed Console Logging
Added temporary `[YouTube Player Debug]` logs checking:
- Iframe mount/unmount and src updates (via callback ref)
- Embed URL state changes
- YouTube Player creation/destruction triggers
- Periodic progress-save events
