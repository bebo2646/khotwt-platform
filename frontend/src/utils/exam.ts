import API from '../services/api';
import { useModalStore } from '../store/modalStore';

/**
 * Checks if an exam or homework is currently available to start based on its schedule.
 * Hits the backend validation endpoint for authoritative verification,
 * shows a premium alert modal, and returns whether entry is allowed.
 */
export const checkExamAvailability = async (examId: number): Promise<boolean> => {
  try {
    const res = await API.get(`/exams/${examId}/check-availability`);
    return !!res.data.available;
  } catch (err: any) {
    console.error(err);
    const msg = err.response?.data?.message || 'هذا التقييم غير متاح حالياً.';
    const isNotStarted = err.response?.data?.error_code === 'SCHEDULE_NOT_STARTED';
    const isAttemptsReached = err.response?.data?.error_code === 'ATTEMPTS_LIMIT_REACHED';
    
    useModalStore.getState().showAlert({
      title: isAttemptsReached ? 'تم استنفاد المحاولات' : isNotStarted ? 'التقييم غير متاح بعد' : 'انتهى موعد التقييم',
      description: msg,
      type: isNotStarted ? 'warning' : 'error',
      buttonText: 'حسناً'
    });
    return false;
  }
};
