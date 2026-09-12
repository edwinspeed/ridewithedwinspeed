async function getBookings(){
  const response=await fetch('/api/bookings');
  if(!response.ok) throw new Error('Server unavailable');
  return response.json();
}

function escapeHtml(v){
  return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function updateStatus(ref,status){
  const response=await fetch('/api/bookings/'+encodeURIComponent(ref),{
    method:'PATCH',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({status})
  });
  if(!response.ok){alert('Could not update booking.');return;}
  render();
}

async function render(){
  const box=document.getElementById('bookings');
  try{
    const items=await getBookings();
    document.getElementById('total').textContent=items.length;
    document.getElementById('pending').textContent=items.filter(x=>x.status==='Pending').length;
    document.getElementById('ontheway').textContent=items.filter(x=>x.status==='On the Way').length;
    document.getElementById('delivered').textContent=items.filter(x=>x.status==='Delivered').length;

    if(!items.length){box.innerHTML='<p>No bookings yet.</p>';return;}
    const statuses=['Pending','Rider Assigned','Picked Up','On the Way','Delivered','Cancelled'];
    box.innerHTML=items.map(x=>`
      <article class="booking">
        <div class="booking-top"><div><div class="ref">${escapeHtml(x.reference)}</div><strong>${escapeHtml(x.service)}</strong></div><span class="status">${escapeHtml(x.status)}</span></div>
        <div class="details">
          <div><b>Customer:</b> ${escapeHtml(x.name)}</div><div><b>Phone:</b> ${escapeHtml(x.phone)}</div>
          <div><b>Pickup:</b> ${escapeHtml(x.pickup)}</div><div><b>Drop-off:</b> ${escapeHtml(x.dropoff)}</div>
          <div><b>Details:</b> ${escapeHtml(x.details)}</div>
        </div>
        <div class="actions">${statuses.map(s=>`<button class="btn ${s===x.status?'primary':''}" onclick="updateStatus(decodeURIComponent('${encodeURIComponent(x.reference)}'),'${s}')">${s}</button>`).join('')}</div>
      </article>`).join('');
  }catch(e){
    box.innerHTML='<p>Dashboard server is not connected yet. Start the Node server to receive live bookings.</p>';
  }
}
render();
