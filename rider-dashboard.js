let currentBookings=[];
async function load(){const me=await fetch('/api/riders/me');if(!me.ok){location.href='/rider-login.html';return;}const data=await me.json();const r=data.rider;
document.getElementById('riderName').textContent=r.full_name;
document.getElementById('riderDetails').textContent=[r.phone,r.email,r.bike_model,r.plate_number].filter(Boolean).join(' • ');
document.getElementById('riderStatus').textContent=r.status;
const res=await fetch('/api/riders/my-bookings');if(!res.ok){document.getElementById('bookings').innerHTML='<p class="muted">Could not load deliveries.</p>';return;}
currentBookings=await res.json();render();}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function render(){const el=document.getElementById('bookings');if(!currentBookings.length){el.innerHTML='<p class="muted">No deliveries have been assigned to you yet.</p>';return;}
el.innerHTML=currentBookings.map(b=>`<article class="job"><div class="job-top"><strong>${esc(b.reference)}</strong><span class="badge">${esc(b.status)}</span></div><p><b>${esc(b.service)}</b></p><p><b>Pickup:</b> ${esc(b.pickup)}</p><p><b>Drop-off:</b> ${esc(b.dropoff)}</p><p><b>Customer:</b> ${esc(b.customer_name)} (${esc(b.customer_phone)})</p><p>${esc(b.details)}</p><div class="actions">
${b.status==='Rider Assigned'?'<button onclick="updateStatus(\''+esc(b.reference)+'\',\'Picked Up\')">Picked Up</button>':''}
${b.status==='Picked Up'?'<button onclick="updateStatus(\''+esc(b.reference)+'\',\'On the Way\')">On the Way</button>':''}
${b.status==='On the Way'?'<button onclick="updateStatus(\''+esc(b.reference)+'\',\'Delivered\')">Delivered</button>':''}
</div></article>`).join('');}
async function updateStatus(ref,status){const r=await fetch('/api/riders/my-bookings/'+encodeURIComponent(ref)+'/status',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});const d=await r.json();if(!r.ok){alert(d.error||'Update failed');return;}await load();}
document.getElementById('logoutButton').onclick=async()=>{await fetch('/api/riders/logout',{method:'POST'});location.href='/rider-login.html';};
load();