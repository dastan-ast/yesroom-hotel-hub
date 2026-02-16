

# Fix: Multi-Room Booking Architecture

## Problem

When an admin selects multiple rooms during manual booking, the system creates **one booking record** with multiple entries in `booking_rooms`. This single booking has only one set of dates, one daily rate, and one service list -- so the bill shows the price of 1 room instead of N rooms, checkout calculates incorrectly, and rooms can't have independent dates or services.

## Root Cause

The architecture treats "1 booking + N rooms" as a single entity, but the business logic requires each room to be independent (own dates, services, billing, extension).

## Solution: One Room = One Booking

Change `ManualBookingDialog` so that selecting N rooms creates **N separate booking records**, each with its own `room_id`. The existing phone-based grouping in `BookingsTab` will automatically combine them into one card for the guest.

This aligns with how the system already handles grouped bookings and makes each room truly independent.

---

## Changes

### 1. ManualBookingDialog.tsx -- Create separate bookings per room

Instead of inserting 1 booking + N `booking_rooms`, insert N bookings each with a single `room_id`:

```
Selected rooms: [101, 102, 103]
  -> booking #1: room_id = 101
  -> booking #2: room_id = 102  
  -> booking #3: room_id = 103
```

- Same guest name, phone, dates, room type for all
- Each booking gets its own `room_id` and status `approved`
- Remove the `booking_rooms` insert logic for new multi-room bookings
- Room status updated to `booked` for each

### 2. BookingDetailModal.tsx -- Fix billing formula

Update `getBookingCalc` to account for `allRooms.length` for backward compatibility with any existing bookings that still use `booking_rooms`:

```
stayTotal = nights * dailyRate * Math.max(booking.allRooms.length, 1)
```

Update the bill display to show per-room lines when `allRooms.length > 1`:
```
"2 номера x 3 ночи x 10,000 T = 60,000 T"
```

### 3. BookingsTab.tsx -- Room count badge fix

Update the grouping logic to show the room count badge correctly:
- For phone-grouped bookings: count = number of bookings in group
- Badge always shows when `roomCount > 1`

### 4. Checkout total fix

No separate fix needed -- fixing the billing formula and the "1 room = 1 booking" architecture automatically fixes checkout totals, since each booking now represents exactly 1 room.

---

## Technical Details

| File | Change |
|------|--------|
| `src/components/admin/ManualBookingDialog.tsx` | Loop over `selectedRooms` to create N separate bookings instead of 1 booking + N `booking_rooms` |
| `src/components/admin/BookingDetailModal.tsx` | Multiply `stayTotal` by `allRooms.length` for backward compat; show per-room bill lines |
| `src/components/admin/BookingsTab.tsx` | Ensure room count badge displays correctly for grouped bookings |

### Backward Compatibility
- Existing bookings with `booking_rooms` entries continue to work via the existing `allRooms` fetch logic in `BookingDetailModal`
- New bookings will use the cleaner 1:1 booking-to-room model
- Phone-based grouping in `BookingsTab` handles display for both old and new bookings

