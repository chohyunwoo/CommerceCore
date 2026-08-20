export enum DeliveryStage {
  COLLECTED = 'COLLECTED',
  IN_TRANSIT = 'IN_TRANSIT',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
}

/** 배송 단계는 이 순서로만 기록될 수 있다 — 건너뛰거나 되돌아갈 수 없다. */
export const DELIVERY_STAGE_ORDER: DeliveryStage[] = [
  DeliveryStage.COLLECTED,
  DeliveryStage.IN_TRANSIT,
  DeliveryStage.OUT_FOR_DELIVERY,
  DeliveryStage.DELIVERED,
];
