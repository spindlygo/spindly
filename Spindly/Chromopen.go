package Spindly

import (
	"os"
	"os/exec"
	"runtime"
	"time"
)

// Open tries to open url in a browser and reports whether it succeeded.
func TryAndOpenChromiumWindow(url string, fallBackToDefaultBrowser bool) bool {

	_, noChrome := os.LookupEnv("NOCHROME")
	if noChrome {
		return false
	}

	chromeArgs := []string{
		"--disable-client-side-phishing-detection ",
		"--disable-default-apps ",
		"--disable-infobars ",
		"--disable-extensions ",
		"--disable-ipc-flooding-protection ",
		"--disable-popup-blocking ",
		"--disable-prompt-on-repost ",
		"--disable-sync ",
		"--disable-translate ",
		"--disable-windows10-custom-titlebar ",
		"--no-first-run ",
		"--no-default-browser-check ",
		"--safebrowsing-disable-auto-update ",
	}

	switch runtime.GOOS {
	case "darwin": // Mac OS

		chromeLocations := []string{
			"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
			"/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
			"/Applications/Chromium.app/Contents/MacOS/Chromium",
			"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
			"/usr/bin/google-chrome",
			"/usr/bin/chromium",
		}

		for _, channel := range []string{"", "-stable", "-browser", "-beta", "-canary", "-dev", "-nightly"} {
			for _, chromiumBrowser := range chromeLocations {
				if programExists(chromiumBrowser + channel) {
					if tryOpenCmd(chromiumBrowser+channel, "--app="+url, chromeArgs) {
						return true
					}
				}
			}
		}

		for _, chromeBin := range []string{string('"') + "Google Chrome" + string('"'), string('"') + "Microsoft Edge" + string('"')} {
			if tryOpenCmd("open -a "+chromeBin, "--app="+url, chromeArgs) {
				return true
			}
		}

		if fallBackToDefaultBrowser && tryOpenCmd("/usr/bin/open", url, nil) {
			return true
		}

	case "windows":

		envLocalAppData := os.Getenv("LocalAppData")
		envProgramFiles := os.Getenv("ProgramFiles")
		envProgramFilesx86 := os.Getenv("ProgramFiles(x86)")

		chromeLocations := []string{
			envProgramFiles + "/Microsoft/Edge/Application/msedge.exe",
			envProgramFilesx86 + "/Microsoft/Edge/Application/msedge.exe",
			envProgramFiles + "/Google/Chrome/Application/chrome.exe",
			envProgramFilesx86 + "/Google/Chrome/Application/chrome.exe",
			envProgramFiles + "/Chromium/Application/chrome.exe",
			envProgramFilesx86 + "/Chromium/Application/chrome.exe",
			envLocalAppData + "/Google/Chrome/Application/chrome.exe",
			envLocalAppData + "/Chromium/Application/chrome.exe",
		}

		for _, chromiumBrowser := range chromeLocations {
			if programExists(chromiumBrowser) {
				if tryOpenCmd(chromiumBrowser, "--app="+url, chromeArgs) {
					return true
				}
			}
		}

		if fallBackToDefaultBrowser {
			// Lets hope that the user didn't find a way to uninstall Edge.
			if tryOpenCmd("cmd", "/c", []string{"start", "msedge", "--app=" + url}) {
				return true
			}

			if tryOpenCmd("cmd", "/c", []string{"start", url}) {
				return true
			}
		}

	default:
		// case "linux":
		for _, channel := range []string{"", "-stable", "-browser", "-beta", "-canary", "-dev", "-nightly"} {
			for _, chromiumBrowser := range []string{"google-chrome", "chromium", "chrome", "msedge", "vivaldi", "opera", "brave", "/snap/bin/chromium"} {
				if programExists(chromiumBrowser + channel) {
					if tryOpenCmd(chromiumBrowser+channel, "--app="+url, chromeArgs) {
						return true
					}
				}
			}

		}

		if fallBackToDefaultBrowser {

			if programExists("firefox") {
				if tryOpenCmd("firefox", "-ssb "+url, nil) {
					return true
				}
			}

			if programExists("firefox-stable") {
				if tryOpenCmd("firefox-stable", "-ssb "+url, nil) {
					return true
				}
			}

			if os.Getenv("DISPLAY") != "" {
				// xdg-open is only for use in a desktop environment.
				if tryOpenCmd("xdg-open", url, nil) {
					return true
				}
			}
		}

	}
	return false
}

func programExists(program string) bool {
	_, err := exec.LookPath(program)
	return err == nil
}

func tryOpenCmd(prg string, arg0 string, args []string) bool {
	cmd := exec.Command(prg, append([]string{arg0}, args...)...)

	if cmd.Start() == nil && appearsSuccessful(cmd, 3*time.Second) {
		println("Opening window with '" + prg + "'")
		return true
	}

	return false
}

// appearsSuccessful reports whether the command appears to have run successfully.
// If the command runs longer than the timeout, it's deemed successful.
// If the command runs within the timeout, it's deemed successful if it exited cleanly.
func appearsSuccessful(cmd *exec.Cmd, timeout time.Duration) bool {
	errc := make(chan error, 1)
	go func() {
		errc <- cmd.Wait()
	}()

	select {
	case <-time.After(timeout):
		return true
	case err := <-errc:
		return err == nil
	}
}
