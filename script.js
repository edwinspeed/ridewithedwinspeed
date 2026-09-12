function toggleMenu(){
  document.getElementById('navLinks').classList.toggle('open');
}

function createBookingReference(){
  const year = new Date().getFullYear();
  const number = Math.floor(1000 + Math.random() * 9000);
  return `RWE-${year}-${number}`;
}

document.getElementById('bookingForm').addEventListener('submit', async function(e){
  e.preventDefault();

  const booking = {
    reference: createBookingReference(),
    service: document.getElementById('service').value,
    name: document.getElementById('name').value.trim(),
    phone: document.getElementById('phone').value.trim(),
    pickup: document.getElementById('pickup').value.trim(),
    dropoff: document.getElementById('dropoff').value.trim(),
    details: document.getElementById('details').value.trim(),
    preferred_time: document.getElementById('time').value.trim() || 'Not specified'
  };

  if(!booking.service || !booking.name || !booking.phone || !booking.pickup || !booking.dropoff || !booking.details){
    alert('Please complete all required fields.');
    return;
  }

  let savedOnline = false;
  try {
    const response = await fetch('/api/bookings', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(booking)
    });
    savedOnline = response.ok;
  } catch(err) {
    // Demo/static mode: continue to WhatsApp even when no server is connected.
  }

  localStorage.setItem(booking.reference, JSON.stringify({
    ...booking,
    status: 'Request received — awaiting confirmation'
  }));

  const confirmation = document.getElementById('bookingConfirmation');
  confirmation.hidden = false;
  confirmation.innerHTML =
    `<strong>Booking request created.</strong><br>
     Reference: <strong>${booking.reference}</strong><br>
     ${savedOnline ? 'Your request has been saved online. ' : ''}
     WhatsApp will open so you can send the request to our team.`;

  const message =
`Hello RideWithEdwinSpeed, I want to make a booking.

Booking Reference: ${booking.reference}
Service: ${booking.service}
Name: ${booking.name}
Phone: ${booking.phone}
Pickup: ${booking.pickup}
Drop-off: ${booking.dropoff}
Details: ${booking.details}
Preferred time: ${booking.preferred_time}`;

  window.open('https://wa.me/2347068552116?text=' + encodeURIComponent(message), '_blank');
});

async function checkTracking(){
  const code = document.getElementById('trackingCode').value.trim().toUpperCase();
  const result = document.getElementById('trackingResult');
  if(!code){
    result.hidden=false;
    result.textContent='Please enter your booking reference.';
    return;
  }

  try {
    const response = await fetch('/api/bookings/' + encodeURIComponent(code));
    if(response.ok){
      const booking = await response.json();
      result.hidden=false;
      result.innerHTML = `<strong>${booking.reference}</strong><br>Status: <strong>${booking.status}</strong><br>Service: ${booking.service}<br>Pickup: ${booking.pickup}<br>Drop-off: ${booking.dropoff}`;
      return;
    }
  } catch(err) {}

  const saved = localStorage.getItem(code);
  result.hidden=false;
  if(saved){
    const booking=JSON.parse(saved);
    result.innerHTML=`<strong>${booking.reference}</strong><br>Status: <strong>${booking.status}</strong>`;
  } else {
    result.innerHTML=`We could not find <strong>${code}</strong>. Please contact 0706 855 2116 or 0704 861 0914.`;
  }
}
