import { app, dialog, shell } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

let virtualCameraInstance: any = null;
let extensionInstalled = false;

async function checkSystemExtensionStatus(): Promise<boolean> {
  if (process.platform !== 'darwin') {
    return false;
  }

  try {
    const { stdout } = await execAsync('systemextensionsctl list');
    return stdout.includes('com.disintegration-studio.virtual-camera.extension');
  } catch (error) {
    console.error('Failed to check system extension status:', error);
    return false;
  }
}

async function installSystemExtension(): Promise<boolean> {
  if (process.platform !== 'darwin') {
    console.log('System Extensions only available on macOS');
    return false;
  }

  const extensionPath = path.join(
    app.getAppPath(),
    '../Library/SystemExtensions/CamFXCameraExtension.appex'
  );

  if (!fs.existsSync(extensionPath)) {
    console.error('System Extension not found at:', extensionPath);
    
    const result = await dialog.showMessageBox({
      type: 'error',
      title: 'System Extension Not Found',
      message: 'Native Virtual Camera Extension Missing',
      detail: 'The Disintegration Studio virtual camera extension was not found in the app bundle. ' +
              'This may happen in development mode. You can still use the fallback ' +
              'MediaStream mode with OBS Virtual Camera.',
      buttons: ['OK', 'Learn More'],
      defaultId: 0,
    });

    if (result.response === 1) {
      shell.openExternal(
        'https://github.com/ColemanSWE/disintegration-studio'
      );
    }

    return false;
  }

  try {
    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Install Virtual Camera',
      message: 'Disintegration Studio needs to install a System Extension',
      detail: 'This allows Disintegration Studio to create a virtual camera that appears in all video apps. ' +
              'macOS will ask for your permission to install the extension.\n\n' +
              'After clicking Install:\n' +
              '1. macOS will show a security dialog\n' +
              '2. Open System Preferences → Security & Privacy\n' +
              '3. Click "Allow" for Disintegration Studio\n' +
              '4. Restart Disintegration Studio',
      buttons: ['Install', 'Use OBS Instead', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
    });

    if (result.response === 1) {
      return false;
    }

    if (result.response === 2) {
      return false;
    }

    console.log('Installing system extension from:', extensionPath);
    
    await dialog.showMessageBox({
      type: 'info',
      title: 'Installation Started',
      message: 'Installing Virtual Camera Extension',
      detail: 'If you see a message about "System Extension Blocked":\n\n' +
              '1. Open System Preferences\n' +
              '2. Go to Security & Privacy\n' +
              '3. Click the "Allow" button for Disintegration Studio\n' +
              '4. Restart Disintegration Studio\n\n' +
              'Click OK to continue.',
      buttons: ['OK'],
    });

    extensionInstalled = true;
    return true;
  } catch (error) {
    console.error('Failed to install system extension:', error);
    
    await dialog.showMessageBox({
      type: 'error',
      title: 'Installation Failed',
      message: 'Could not install virtual camera extension',
      detail: 'You can still use Disintegration Studio with OBS Virtual Camera. ' +
              'See Help for setup instructions.',
      buttons: ['OK'],
    });

    return false;
  }
}

export async function initializeVirtualCamera(): Promise<boolean> {
  if (process.platform !== 'darwin' && process.platform !== 'linux') {
    console.log('Virtual camera native module only available on macOS and Linux');
    return false;
  }

  if (process.platform === 'darwin') {
    const isInstalled = await checkSystemExtensionStatus();
    
    if (!isInstalled) {
      console.log('System Extension not installed, prompting user...');
      const installed = await installSystemExtension();
      
      if (!installed) {
        return false;
      }
    }
  }

  try {
    const nativeModulePath = path.join(__dirname, '../../native');
    
    if (!fs.existsSync(nativeModulePath)) {
      console.error('Native module not found at:', nativeModulePath);
      return false;
    }

    const module = require(nativeModulePath);
    
    if (module && module.VirtualCamera) {
      virtualCameraInstance = new module.VirtualCamera();
      console.log('Native virtual camera module loaded successfully');
      return true;
    } else {
      console.error('VirtualCamera class not found in native module');
      return false;
    }
  } catch (error) {
    console.error('Failed to load native virtual camera module:', error);
    return false;
  }
}

export async function startVirtualCamera(): Promise<boolean> {
  if (!virtualCameraInstance) {
    console.error('Virtual camera not initialized');
    return false;
  }

  try {
    const result = await virtualCameraInstance.start();
    
    if (!result) {
      await dialog.showMessageBox({
        type: 'error',
        title: 'Virtual Camera Failed',
        message: 'Could not start virtual camera',
        detail: 'The System Extension may need to be approved. ' +
                'Check System Preferences → Security & Privacy, ' +
                'then restart Disintegration Studio.',
        buttons: ['OK'],
      });
    }
    
    return result;
  } catch (error) {
    console.error('Failed to start virtual camera:', error);
    return false;
  }
}

export async function stopVirtualCamera(): Promise<boolean> {
  if (!virtualCameraInstance) {
    return false;
  }

  try {
    return await virtualCameraInstance.stop();
  } catch (error) {
    console.error('Failed to stop virtual camera:', error);
    return false;
  }
}

export async function pushFrameToCamera(
  buffer: Buffer,
  width: number,
  height: number
): Promise<boolean> {
  if (!virtualCameraInstance) {
    return false;
  }

  try {
    return await virtualCameraInstance.pushFrame(buffer, width, height);
  } catch (error) {
    console.error('Failed to push frame to virtual camera:', error);
    return false;
  }
}

export function isVirtualCameraRunning(): boolean {
  if (!virtualCameraInstance) {
    return false;
  }

  try {
    return virtualCameraInstance.isRunning();
  } catch (error) {
    console.error('Failed to check virtual camera status:', error);
    return false;
  }
}

export async function uninstallSystemExtension(): Promise<boolean> {
  if (process.platform !== 'darwin') {
    console.log('Uninstall system extension is only relevant on macOS');
    return false;
  }

  try {
    const result = await dialog.showMessageBox({
      type: 'warning',
      title: 'Uninstall Virtual Camera',
      message: 'Remove Disintegration Studio System Extension?',
      detail: 'This will remove the virtual camera from your system. ' +
              'You can reinstall it later by starting the virtual camera again.',
      buttons: ['Uninstall', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
    });

    if (result.response === 1) {
      return false;
    }

    await execAsync('systemextensionsctl uninstall - com.disintegration-studio.virtual-camera.extension');
    
    await dialog.showMessageBox({
      type: 'info',
      title: 'Uninstalled',
      message: 'Virtual camera extension removed',
      detail: 'The extension has been uninstalled. You may need to restart your computer ' +
              'for the changes to take full effect.',
      buttons: ['OK'],
    });

    extensionInstalled = false;
    return true;
  } catch (error) {
    console.error('Failed to uninstall system extension:', error);
    return false;
  }
}

