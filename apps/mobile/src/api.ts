import * as SecureStore from 'expo-secure-store'
const base = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://10.0.2.2:8000/api/v1'
export async function api<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> { const response = await fetch(`${base}${path}`, { ...init, headers: { 'Content-Type':'application/json', ...(token ? {Authorization:`Bearer ${token}`} : {}), ...init.headers } }); if (!response.ok) { const body = await response.json().catch(()=>({})); throw new Error(body.detail || `Request failed (${response.status})`) } return response.json() as Promise<T> }
export async function saveToken(token: string) { await SecureStore.setItemAsync('m3-access-token', token) }
export async function removeToken() { await SecureStore.deleteItemAsync('m3-access-token') }
