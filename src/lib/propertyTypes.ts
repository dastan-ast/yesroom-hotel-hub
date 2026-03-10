import { Building2, Tent, Home, TreePine, Hotel, Castle, Warehouse, Mountain } from 'lucide-react';

export const PROPERTY_TYPES = [
  { value: 'hotel', label: 'Отель', icon: Hotel },
  { value: 'hostel', label: 'Хостел', icon: Building2 },
  { value: 'guest_house', label: 'Гостевой дом', icon: Home },
  { value: 'camping', label: 'Кемпинг', icon: Tent },
  { value: 'resort', label: 'Зона отдыха', icon: TreePine },
  { value: 'cottage', label: 'Коттедж / Дача', icon: Home },
  { value: 'glamping', label: 'Глэмпинг', icon: Mountain },
  { value: 'apart_hotel', label: 'Апарт-отель', icon: Warehouse },
  { value: 'villa', label: 'Вилла', icon: Castle },
] as const;

export type PropertyType = typeof PROPERTY_TYPES[number]['value'];

export function getPropertyTypeLabel(value: string): string {
  return PROPERTY_TYPES.find(pt => pt.value === value)?.label || 'Отель';
}

export function getPropertyTypeIcon(value: string) {
  return PROPERTY_TYPES.find(pt => pt.value === value)?.icon || Building2;
}
