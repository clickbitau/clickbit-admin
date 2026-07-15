import axios from 'axios';
import { CompaniesListResponse } from '@clickbit/shared';

const api = axios.create({
  baseURL: '/',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function fetchCompanies(
  token: string,
  params?: Record<string, string | number | boolean>,
): Promise<CompaniesListResponse> {
  const response = await api.get<CompaniesListResponse>('/api/crm/companies', {
    params,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
}

export default api;
