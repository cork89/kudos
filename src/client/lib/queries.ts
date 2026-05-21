import { useQuery } from '@tanstack/react-query';
import { fetchEdit, fetchHome, fetchView } from './api';

export function useHomeQuery() {
  return useQuery({
    queryKey: ['home'],
    queryFn: fetchHome,
  });
}

export function useViewQuery() {
  return useQuery({
    queryKey: ['view'],
    queryFn: fetchView,
  });
}

export function useEditQuery() {
  return useQuery({
    queryKey: ['edit'],
    queryFn: fetchEdit,
  });
}
