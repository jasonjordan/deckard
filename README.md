# Deckard: A Web-Based Android Fleet Manager

Deckard is a powerful, browser-based tool for managing and interacting with a fleet of Android devices simultaneously. It leverages the TangoADB library to establish real ADB (Android Debug Bridge) connections over your local network, allowing you to control multiple devices from a single web interface.

## About The Project

This tool was built to streamline the process of managing multiple Android devices for development, testing, and quality assurance. Instead of repeating commands on each device individually, Deckard provides a centralized dashboard to send commands, monitor screens, and perform common actions across all connected devices at once.

Key features include:
*   **Network Discovery:** Automatically scan your local network to find and connect to ADB-enabled devices.
*   **Manual Connection:** Connect to devices directly via their IP address.
*   **Fleet Command Execution:** Run common ADB commands (reboot, force-stop, etc.) across all connected devices at once from a central control panel.
*   **Device Screen Placeholder:** View a static placeholder image for each device's screen to confirm its connection status.
*   **Mass APK Installation:** Install an APK on all connected devices by providing its full on-device path.
*   **Standard ADB Actions:** Perform common ADB tasks like rebooting, force-stopping applications, toggling layout bounds, and uninstalling packages on the entire fleet.

### Built With

*   [React](https://reactjs.org/)
*   [TypeScript](https://www.typescriptlang.org/)
*   [Vite](https://vitejs.dev/)
*   [TangoADB](https://github.com/Tango-ADB/Tango-ADB)

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

*   **Node.js and npm:** Make sure you have Node.js and npm installed. You can download them from [nodejs.org](https://nodejs.org/).
*   **Android Devices:** You will need one or more Android devices.
*   **Network ADB:** You must enable "Wireless debugging" (or "ADB over Network" on older Android versions) on each device. You can find this option in the Developer Options on your Android device. Ensure the devices are on the same local network as the computer running Deckard.

### Installation

1.  Clone the repository:
    ```sh
    git clone https://github.com/your_username/deckard.git
    ```
2.  Install NPM packages:
    ```sh
    npm install
    ```
3.  Start the development server:
    ```sh
    npm run dev
    ```
    The application will be available at `http://localhost:3001` (or the next available port).

## Usage

Once the application is running, you can start managing your devices.

1.  **Connect Devices:**
    *   Use the **"Scan Network"** button to automatically discover devices on your network.
    *   Use the **"Add Device"** button to connect to a device manually by entering its IP address and port.

2.  **Interact with the Fleet:**
    *   **Install APK:** From the "Install" tab, provide the full path to an APK file that is already on the devices (e.g., `/sdcard/Download/app.apk`), and click the install button to deploy it to the entire fleet.
    *   **ADB Panel:** Switch to the "ADB" tab to access buttons for common fleet-wide commands like rebooting all devices, uninstalling a package by name, or toggling layout bounds for UI debugging.

3.  **End Session:**
    *   Click the **"End Session"** button in the header to disconnect from all devices and clear the dashboard.
