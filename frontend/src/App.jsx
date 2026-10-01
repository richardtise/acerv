import React from 'react'
import { useAccount } from 'wagmi'
import { ThemeProvider } from './components/ThemeProvider'
import BackgroundEffect from './components/BackgroundEffect'
import Landing from './Landing'
import AcervDashboard from './AcervDashboard'
import './App.css'

export default function App() {
  const { isConnected } = useAccount()

  return (
    <ThemeProvider>
      <div className="app-root">
        <BackgroundEffect />
        {isConnected ? <AcervDashboard /> : <Landing />}
      </div>
    </ThemeProvider>
  )
}
