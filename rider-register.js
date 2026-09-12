const form=document.getElementById('registerForm');
const button=document.getElementById('registerButton');
const message=document.getElementById('registerMessage');
form.addEventListener('submit',async e=>{
 e.preventDefault(); message.textContent=''; button.disabled=true; button.textContent='Submitting...';
 const body={fullName:fullName.value.trim(),phone:phone.value.trim(),email:email.value.trim(),address:address.value.trim(),bikeModel:bikeModel.value.trim(),plateNumber:plateNumber.value.trim(),password:password.value};
 try{const r=await fetch('/api/riders/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error||'Registration failed.');message.className='message success';message.textContent=d.message;form.reset();}catch(err){message.className='message';message.textContent=err.message;}finally{button.disabled=false;button.textContent='Submit Registration';}
});