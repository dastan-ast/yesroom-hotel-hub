import { Navbar } from '@/components/Navbar';
import { BookingForm } from '@/components/BookingForm';

export default function Booking() {
  return (
    <div className="min-h-screen bg-muted/30">
      <Navbar />
      <main className="container mx-auto px-4 py-12">
        <BookingForm />
      </main>
    </div>
  );
}
