import { CONFIG } from './config.js';

let auth;
export async function initAuth(onChange) {
  if (!window.firebase?.auth) throw new Error('No cargó Firebase. Revisa tu conexión o el bloqueo de scripts.');
  if (!window.firebase.apps.length) window.firebase.initializeApp(CONFIG.firebase);
  auth=window.firebase.auth();
  await auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL);
  auth.onAuthStateChanged(async user=>{
    try { if(user) await user.reload(); } catch (_) { user=null; }
    if(user && !user.emailVerified) {
      await auth.signOut();
      onChange(null,'Verifica el correo con el enlace recibido antes de entrar.');
    } else onChange(user || null,'');
  });
}
export const currentUser = () => auth?.currentUser;
export async function token() {
  const user=currentUser();
  if(!user || !user.emailVerified) throw new Error('Inicia sesión con un correo verificado.');
  return user.getIdToken();
}
export const login = (email,password) => auth.signInWithEmailAndPassword(email,password);
export async function register(email,password) {
  const result=await auth.createUserWithEmailAndPassword(email,password);
  await result.user.sendEmailVerification();
  await auth.signOut();
}
export const resetPassword = email => auth.sendPasswordResetEmail(email);
export const logout = () => auth.signOut();
