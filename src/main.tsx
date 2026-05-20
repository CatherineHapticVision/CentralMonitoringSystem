import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
// import { AuthProvider } from './context/AuthContext.tsx'
import { ProfilePhotoProvider } from './context/ProfilePhotoContext.tsx'
// import { AuthGate } from './components/AuthGate.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* <AuthProvider>
      <AuthGate> */}
    <ProfilePhotoProvider>
      <App />
    </ProfilePhotoProvider>
    {/* </AuthGate>
    </AuthProvider> */}
  </StrictMode>,
)
