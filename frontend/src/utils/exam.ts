import { useModalStore } from '../store/modalStore';

/**
 * Checks if an exam is currently available to start based on its schedule.
 * Shows a premium alert modal and returns false if the exam is not available yet or has expired.
 */
export const checkExamAvailability = (exam: any): boolean => {
  if (exam.enable_schedule) {
    const now = new Date();
    
    // Construct open datetime
    let openDatetime: Date | null = null;
    if (exam.open_date) {
      const datePart = exam.open_date.split('T')[0]; // format Y-m-d
      const timePart = exam.open_time || '00:00:00';
      openDatetime = new Date(`${datePart}T${timePart}`);
    }
    
    // Construct close datetime
    let closeDatetime: Date | null = null;
    if (exam.close_date) {
      const datePart = exam.close_date.split('T')[0]; // format Y-m-d
      const timePart = exam.close_time || '23:59:59';
      closeDatetime = new Date(`${datePart}T${timePart}`);
    }
    
    if (openDatetime && now < openDatetime) {
      // Format HH:MM
      const hours = openDatetime.getHours().toString().padStart(2, '0');
      const minutes = openDatetime.getMinutes().toString().padStart(2, '0');
      const formattedTime = `${hours}:${minutes}`;
      
      useModalStore.getState().showAlert({
        title: 'الامتحان غير متاح حالياً',
        description: `This exam will be available at ${formattedTime}.`,
        type: 'warning',
        buttonText: 'حسناً'
      });
      return false;
    }
    
    if (closeDatetime && now > closeDatetime) {
      useModalStore.getState().showAlert({
        title: 'انتهت صلاحية الامتحان',
        description: 'The exam availability period has ended.',
        type: 'error',
        buttonText: 'حسناً'
      });
      return false;
    }
  }
  return true;
};
