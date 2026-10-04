import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/index.css'
import { OesteApp } from './OesteApp'

createRoot(document.getElementById('dolls-root')!).render(
  <StrictMode>
    <OesteApp />
  </StrictMode>,
)
