const fs = require('fs');
const path = require('path');

const loginFile = path.join(__dirname, 'src', 'app', 'login', 'page.tsx');
let content = fs.readFileSync(loginFile, 'utf8');

// Replace imports
content = content.replace(/import { useSignIn, useSignUp, useAuth, useUser } from '@clerk\/nextjs';/g, `import { useAuth } from '@/context/FirebaseAuthContext';\nimport { auth } from '@/lib/firebase';\nimport { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';`);

// Replace Auth Hooks
content = content.replace(/const { isLoaded: isSignInLoaded, signIn, setActive: setSignInActive } = useSignIn\(\);/g, `const { user, loading: authLoading } = useAuth();`);
content = content.replace(/const { isLoaded: isSignUpLoaded, signUp, setActive: setSignUpActive } = useSignUp\(\);/g, ``);
content = content.replace(/const { isSignedIn } = useAuth\(\);/g, `const isSignedIn = !!user;`);
content = content.replace(/const { user } = useUser\(\);/g, ``);

// Replace completeSignIn
content = content.replace(/const completeSignIn = async \(sessionId: string\) => {[\s\S]*?};/g, `const completeSignIn = () => { window.location.href = '/dashboard'; };`);

// Replace handleSignIn
content = content.replace(/const handleSignIn = async \(e: React.FormEvent\) => {[\s\S]*?\/\/ ─── 2FA Submit Handler/g, `const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      completeSignIn();
    } catch (err: any) {
      setError(err.message || 'Sign-in failed. Please check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  // ─── 2FA Submit Handler`);

// Replace handleSignUp
content = content.replace(/const handleSignUp = async \(e: React.FormEvent\) => {[\s\S]*?\/\/ ─── Verification Handler/g, `const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(cred.user);
      setAuthStep('email-verify');
    } catch (err: any) {
      setError(err.message || 'Sign-up failed.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Verification Handler`);

// Replace handleVerification
content = content.replace(/const handleVerification = async \(e: React.FormEvent\) => {[\s\S]*?\/\/ ─── Forgot Password/g, `const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    // Firebase uses email links for verification, so this code block is just a placeholder
    // We will just let them proceed if they clicked the link, but since they are already logged in via createUser, we can just redirect
    completeSignIn();
  };

  // ─── Forgot Password`);

// Replace handleForgotPasswordSubmit
content = content.replace(/const handleForgotPasswordSubmit = async \(e: React.FormEvent\) => {[\s\S]*?\/\/ ─── Reset Password/g, `const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setAuthStep('reset-password');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Reset Password`);

// Replace handleResetPassword
content = content.replace(/const handleResetPassword = async \(e: React.FormEvent\) => {[\s\S]*?return \(/g, `const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('Please click the link in your email to reset your password, then login again.');
  };

  // Google Login
  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      completeSignIn();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (`);

// Replace Google Sign in button onClick
content = content.replace(/<button\s+onClick=\{\(\) => \{[\s\S]*?signIn\?\.authenticateWithRedirect\({[\s\S]*?\}\)[\s\S]*?\}\}/g, `<button onClick={handleGoogleLogin}`);
content = content.replace(/<button\s+onClick=\{\(\) => \{[\s\S]*?signUp\?\.authenticateWithRedirect\({[\s\S]*?\}\)[\s\S]*?\}\}/g, `<button onClick={handleGoogleLogin}`);


fs.writeFileSync(loginFile, content, 'utf8');
console.log('Login page updated to Firebase');
