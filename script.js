        import {
            initializeApp
        } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";

        import {
            getAuth,
            createUserWithEmailAndPassword,
            signInWithEmailAndPassword,
            signOut,
            onAuthStateChanged,
            sendPasswordResetEmail,
            sendEmailVerification,
            verifyBeforeUpdateEmail,
            setPersistence,
            browserLocalPersistence,
            browserSessionPersistence,
            updatePassword,
            EmailAuthProvider,
            reauthenticateWithCredential
        } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

        import {
            getFirestore,
            doc,
            setDoc,
            getDoc,
            collection,
            query,
            where,
            getDocs,
            updateDoc,
            deleteDoc,
            arrayUnion,
            onSnapshot
        } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

        // Configuration
        const firebaseConfig = {
            apiKey: "AIzaSyDIog7SFnvqveAwuraaP-RYsmq21W_urPY",
            authDomain: "blynsaccount.firebaseapp.com",
            projectId: "blynsaccount",
            storageBucket: "blynsaccount.firebasestorage.app",
            messagingSenderId: "541987866723",
            appId: "1:541987866723:web:93f876115029c199885056",
            measurementId: "G-1277QEGSZH"
        };

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);

        let currentUserData = null;
        let currentUserDocId = null;
        let isChangeLocked = false;
        let sessionListener = null;

        // Registration State
        const regData = {
            name: '',
            username: '',
            email: '',
            password: '',
            quizAns: 0,
            tempUserCred: null
        };

        // --- DEVICE DETECTION LOGIC ---
        function getDeviceName() {
            const ua = navigator.userAgent;
            let os = "Unknown Device";
            if (ua.indexOf("Win") !== -1) os = "Windows";
            if (ua.indexOf("Mac") !== -1) os = "MacOS";
            if (ua.indexOf("Linux") !== -1) os = "Linux";
            if (ua.indexOf("Android") !== -1) os = "Android";
            if (ua.indexOf("like Mac") !== -1) os = "iOS";

            let browser = "Web Browser";
            if (ua.indexOf("Chrome") !== -1 && ua.indexOf("Edg") === -1 && ua.indexOf("OPR") === -1) browser = "Chrome";
            else if (ua.indexOf("Safari") !== -1 && ua.indexOf("Chrome") === -1) browser = "Safari";
            else if (ua.indexOf("Firefox") !== -1) browser = "Firefox";
            else if (ua.indexOf("Edg") !== -1) browser = "Edge";
            else if (ua.indexOf("OPR") !== -1 || ua.indexOf("Opera") !== -1) browser = "Opera";

            return `${os} (${browser})`;
        }

        // --- UI UTILS ---
        window.navigate = function(viewId) {
            document.querySelectorAll('#auth-group .auth-box').forEach(el => el.classList.add('hidden'));
            document.getElementById('auth-group').classList.add('hidden');
            document.getElementById('dashboard-group').classList.add('hidden');

            if (viewId === 'dashboard') {
                document.getElementById('dashboard-group').classList.remove('hidden');
                loadDashboard();
            } else {
                document.getElementById('auth-group').classList.remove('hidden');
                const target = document.getElementById('view-' + viewId);
                if (target) {
                    target.classList.remove('hidden');
                    target.style.animation = 'none';
                    target.offsetHeight; /* trigger reflow */
                    target.style.animation = null;
                }
                if (viewId === 'register-1') initRegister();
            }
        };

        window.showToast = function(msg, type = 'info') {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;

            let icon = '';
            if (type === 'success') icon = `<svg width="24" height="24" fill="none" stroke="var(--success-color)" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
            else if (type === 'error') icon = `<svg width="24" height="24" fill="none" stroke="var(--error-color)" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
            else icon = `<svg width="24" height="24" fill="none" stroke="var(--primary)" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;

            toast.innerHTML = `${icon} <span>${msg}</span>`;
            container.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(20px) scale(0.9)';
                setTimeout(() => toast.remove(), 400);
            }, 4000);
        };

        window.togglePassword = function(id) {
            const input = document.getElementById(id);
            input.type = input.type === "password" ? "text" : "password";
        };

        window.openModal = function(id) {
            document.querySelectorAll('.modal-box').forEach(m => m.classList.add('hidden'));
            document.getElementById(id).classList.remove('hidden');
            document.getElementById('modal-overlay').classList.add('active');
        };

        window.closeModal = function() {
            document.getElementById('modal-overlay').classList.remove('active');
        };

        // NEW SMART LOADER 
        let globalLoaderTimeout;
        window.showGlobalLoader = function(text = "Loading your account...") {
            const textEl = document.getElementById('global-loader-text');
            textEl.innerText = text;
            document.getElementById('global-loader').classList.add('active');

            clearTimeout(globalLoaderTimeout);
            globalLoaderTimeout = setTimeout(() => {
                if (document.getElementById('global-loader').classList.contains('active')) {
                    textEl.innerText = text + "\n\nThis may take a while.";
                }
            }, 5000); // Trigger message after 5 seconds
        }

        window.hideGlobalLoader = function() {
            document.getElementById('global-loader').classList.remove('active');
            clearTimeout(globalLoaderTimeout);
        }

        // --- REGISTRATION FLOW ---
        function initRegister() {
            document.getElementById('reg-content-1').classList.add('hidden');
            document.getElementById('reg-loader-1').classList.remove('hidden');

            const n1 = Math.floor(Math.random() * 50) + 20;
            const n2 = Math.floor(Math.random() * 20);
            regData.quizAns = n1 - n2;
            document.getElementById('quiz-question').innerText = `${n1} - ${n2} =`;
            document.getElementById('quiz-answer').value = '';
            document.getElementById('reg-agree').checked = false;

            setTimeout(() => {
                document.getElementById('reg-loader-1').classList.add('hidden');
                document.getElementById('reg-content-1').classList.remove('hidden');
                document.getElementById('reg-content-1').style.animation = 'slideUpFade 0.5s forwards';
            }, 1800);
        }

        window.regNextStep = function(step) {
            if (step === 1) {
                const ans = parseInt(document.getElementById('quiz-answer').value);
                if (!document.getElementById('reg-agree').checked) return showToast('You must agree to the Terms & Conditions.', 'error');
                if (ans !== regData.quizAns) return showToast('Incorrect security answer.', 'error');
                navigate('register-2');
            } else if (step === 2) {
                const name = document.getElementById('reg-name').value.trim();
                if (name.length < 2) return showToast('Please enter a valid full name.', 'error');
                regData.name = name;
                navigate('register-3');
            } else if (step === 3) {
                navigate('register-4');
            } else if (step === 4) {
                navigate('register-5');
            }
        };

        let userCheckTimer;
        window.checkUsernameLive = async function() {
            const val = document.getElementById('reg-username').value.trim();
            const stat = document.getElementById('username-status');
            const btn = document.getElementById('btn-reg-step3');
            btn.style.opacity = '0.5';
            btn.style.pointerEvents = 'none';

            if (val.length < 6) return stat.innerHTML = '<span style="color:var(--error-color); display:flex; align-items:center; gap:6px;"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg> Minimum 6 characters required</span>';
            if (val.includes(' ')) return stat.innerHTML = '<span style="color:var(--error-color); display:flex; align-items:center; gap:6px;"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg> Spaces are not allowed</span>';

            stat.innerHTML = '<div style="display:flex; align-items:center; gap:8px; color:var(--text-muted);"><div class="spinner" style="width:14px; height:14px; border-width:2px; border-top-color:var(--text-main);"></div> Checking availability...</div>';

            clearTimeout(userCheckTimer);
            userCheckTimer = setTimeout(async () => {
                try {
                    const docSnap = await getDoc(doc(db, "users", val));
                    if (!docSnap.exists()) {
                        stat.innerHTML = '<span style="color:var(--success-color); display:flex; align-items:center; gap:6px;"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Username is available</span>';
                        regData.username = val;
                        btn.style.opacity = '1';
                        btn.style.pointerEvents = 'auto';
                    } else {
                        stat.innerHTML = '<span style="color:var(--error-color); display:flex; align-items:center; gap:6px;"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg> Username is already taken</span>';
                    }
                } catch (e) {
                    stat.innerHTML = '<span style="color:var(--success-color); display:flex; align-items:center; gap:6px;"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Username is available (Network Bypass)</span>';
                    regData.username = val;
                    btn.style.opacity = '1';
                    btn.style.pointerEvents = 'auto';
                }
            }, 600);
        };

        let verifyPollInterval;
        window.handleSendRegistrationVerification = async function() {
            const email = document.getElementById('reg-email').value.trim();
            if (!email.includes('@')) return showToast("Please provide a valid email format.", "error");

            const btnSend = document.getElementById('btn-send-reg-email');
            btnSend.disabled = true;
            btnSend.innerHTML = '<div class="spinner" style="width:16px; height:16px; border-width:2px; margin-right:8px;"></div> Dispatching...';

            try {
                const tempPassword = "BlynsTempAuth123!@#" + Math.random().toString(36).substring(7);
                const cred = await createUserWithEmailAndPassword(auth, email, tempPassword);
                regData.tempUserCred = cred;
                regData.email = email;

                await sendEmailVerification(cred.user);
                showToast("Verification link sent securely to your inbox.", "success");

                document.getElementById('resend-timer-text').classList.remove('hidden');
                document.getElementById('reg-verify-loader').classList.remove('hidden');
                btnSend.classList.add('hidden');

                let time = 30;
                const timerEl = document.getElementById('reg-resend-timer');
                const tInt = setInterval(() => {
                    time--;
                    timerEl.innerText = time;
                    if (time <= 0) {
                        clearInterval(tInt);
                        btnSend.classList.remove('hidden');
                        btnSend.innerText = "Resend Verification Link";
                        btnSend.disabled = false;
                        document.getElementById('resend-timer-text').classList.add('hidden');
                    }
                }, 1000);

                verifyPollInterval = setInterval(async () => {
                    await cred.user.reload();
                    if (cred.user.emailVerified) {
                        clearInterval(verifyPollInterval);
                        const loaderText = document.getElementById('reg-verify-loader');
                        loaderText.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; gap:8px;"><svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Email successfully verified!</div>';
                        loaderText.style.color = "var(--success-color)";
                        loaderText.style.animation = "none";

                        const btnNext = document.getElementById('btn-reg-step4');
                        btnNext.classList.remove('hidden');
                        btnNext.style.animation = "slideUpFade 0.4s forwards";
                    }
                }, 3000);

            } catch (e) {
                showToast(e.message, "error");
                btnSend.disabled = false;
                btnSend.innerText = "Verify Email Address";
            }
        };

        window.checkPasswordStrength = function() {
            const p = document.getElementById('reg-password').value;
            let s = 0;
            if (p.length >= 6) s++;
            if (/[a-zA-Z]/.test(p)) s++;
            if (/[0-9]/.test(p)) s++;

            document.getElementById('str-1').className = "strength-dot str-weak" + (s >= 1 ? " active" : "");
            document.getElementById('str-2').className = "strength-dot str-fair" + (s >= 2 ? " active" : "");
            document.getElementById('str-3').className = "strength-dot str-strong" + (s >= 3 ? " active" : "");
        };

        window.finalizeRegistration = async function() {
            const pass = document.getElementById('reg-password').value;
            const conf = document.getElementById('reg-confirm').value;
            if (pass.length < 6 || !/[a-zA-Z]/.test(pass) || !/[0-9]/.test(pass)) return showToast("Password parameters not met.", "error");
            if (pass !== conf) return showToast("Password confirmations do not match.", "error");

            navigate('register-6');

            try {
                if (auth.currentUser) {
                    await updatePassword(auth.currentUser, pass);
                    const now = Date.now();

                    const currentDevice = getDeviceName();
                    await setDoc(doc(db, "users", regData.username), {
                        uid: auth.currentUser.uid,
                        auth: {
                            email: regData.email,
                            verified: true
                        },
                        profile: {
                            username: regData.username,
                            displayName: regData.name,
                            createdAt: now,
                            lastUpdated: now
                        },
                        security: {
                            lastLogin: now,
                            devices: [currentDevice],
                            sessionActive: true
                        },
                        logs: []
                    }, {
                        merge: true
                    });

                    await setDoc(doc(db, "profile_change_lock", regData.username), {
                        createdAt: now,
                        lockUntil: now + (24 * 60 * 60 * 1000)
                    });

                    setTimeout(async () => {
                        document.getElementById('reg-process-loading').classList.add('hidden');
                        document.getElementById('reg-process-success').classList.remove('hidden');
                        await signOut(auth);
                    }, 2000);
                }
            } catch (e) {
                showToast("Account finalization encountered an error: " + e.message, "error");
                navigate('register-5');
            }
        };

        // --- LOGIN & AUTH ---
        window.handleLogin = async function(e) {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const pass = document.getElementById('login-password').value;
            const remember = document.getElementById('login-remember').checked;

            const btn = document.getElementById('btn-login');
            btn.innerHTML = '<div class="spinner" style="width:20px; height:20px; border-width:2px; margin-right:10px;"></div> Authenticating...';
            btn.disabled = true;

            try {
                await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
                const cred = await signInWithEmailAndPassword(auth, email, pass);
                if (!cred.user.emailVerified) {
                    await signOut(auth);
                    btn.innerHTML = 'Sign In';
                    btn.disabled = false;
                    return showToast("Account restricted. Please verify your email first.", "error");
                }
                document.getElementById('form-login').reset();
            } catch (e) {
                showToast("Authentication failed. Invalid credentials.", "error");
                btn.innerHTML = 'Sign In';
                btn.disabled = false;
            }
        };

        window.handleLogout = async function() {
            showGlobalLoader("Signing out...");
            try {
                if (currentUserDocId) {
                    await updateDoc(doc(db, "users", currentUserDocId), {
                        "security.sessionActive": false
                    });
                }
            } catch (e) {
                console.warn("Failed to update session status on logout", e);
            }

            setTimeout(async () => {
                await signOut(auth);
                hideGlobalLoader();
            }, 1200);
        };

        window.handleResetPassword = async function() {
            const email = document.getElementById('reset-email').value;
            if (!email) return showToast("Please provide an email address.", "error");

            const btn = document.getElementById('btn-reset-pass');
            btn.disabled = true;
            btn.innerHTML = '<div class="spinner" style="width:20px; height:20px; border-width:2px;"></div>';

            try {
                await sendPasswordResetEmail(auth, email);
                showToast("Secure reset instructions dispatched.", "success");
                btn.innerHTML = 'Link Sent ✓';
            } catch (e) {
                showToast(e.message, "error");
                btn.disabled = false;
                btn.innerHTML = 'Send Reset Link';
            }
        };

        window.handleForgotEmail = async function() {
            const un = document.getElementById('forgot-username-input').value.trim();
            const res = document.getElementById('forgot-email-result');
            if (!un) return;

            const btn = document.getElementById('btn-search-account');
            btn.disabled = true;
            btn.innerHTML = '<div class="spinner" style="width:20px; height:20px; border-width:2px;"></div>';
            res.innerHTML = '<div class="skeleton" style="width:180px;height:20px;margin:0 auto;border-radius:10px;"></div>';

            try {
                const docSnap = await getDoc(doc(db, "users", un));
                if (docSnap.exists()) {
                    const em = docSnap.data().auth.email;
                    const [name, domain] = em.split('@');
                    let maskedName;
                    if (name.length > 5) {
                        maskedName = name.substring(0, 2) + '*'.repeat(name.length - 5) + name.substring(name.length - 3);
                    } else {
                        maskedName = name.substring(0, 1) + '*'.repeat(name.length - 1);
                    }

                    res.innerHTML = `Identity Verified. Bound Email: <span style="color:var(--primary); font-weight:700; display:block; margin-top:8px; font-size:18px;">${maskedName}@${domain}</span>`;
                } else {
                    res.innerHTML = '<span style="color:var(--error-color); display:flex; align-items:center; justify-content:center; gap:8px;"><svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg> Identity unrecognised in the system.</span>';
                }
            } catch (e) {
                res.innerHTML = "Security protocol blocked the query.";
            }

            btn.disabled = false;
            btn.innerHTML = 'Search Account';
        };

        window.openDeviceManagement = function() {
            const list = document.getElementById('device-list-container');
            list.innerHTML = '';

            const currentDev = getDeviceName();
            const devices = currentUserData?.security?.devices || [currentDev];

            devices.forEach(dev => {
                const isCurrent = dev === currentDev;
                const activeText = isCurrent ? "Active now" : "Previously active";
                const activeColor = isCurrent ? "var(--success-color)" : "var(--text-muted)";

                list.innerHTML += `
                    <div style="display: flex; justify-content: space-between; align-items: center; background: #F9F9F9; padding:16px; border-radius:var(--radius-md); margin-bottom: 12px; border:1px solid var(--border-color);">
                        <div>
                            <p style="font-weight: 600; font-size: 14px; margin-bottom:4px; display:flex; align-items:center; gap:8px;">
                                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                                ${dev} ${isCurrent ? '<span style="font-size:11px; background:var(--surface-color); padding:2px 6px; border-radius:4px; border:1px solid var(--border-color);">Current</span>' : ''}
                            </p>
                            <p style="font-size: 12px; font-weight:500; color: ${activeColor};">${activeText}</p>
                        </div>
                        ${!isCurrent ? `<button style="border:none; background:none; color:var(--error-color); cursor:pointer; font-weight:600; font-size:13px; padding:8px;" onclick="removeSingleDevice('${dev}')">Revoke</button>` : ''}
                    </div>
                `;
            });
            openModal('modal-devices');
        };

        window.removeSingleDevice = async function(devName) {
            showGlobalLoader("Revoking device access...");
            try {
                const currentDev = getDeviceName();
                const newDevices = currentUserData.security.devices.filter(d => d !== devName);

                await updateDoc(doc(db, "users", currentUserDocId), {
                    "security.devices": newDevices,
                    "security.revokeEvent": {
                        revokedDevice: devName,
                        revokedBy: currentDev,
                        timestamp: Date.now()
                    },
                    logs: arrayUnion({
                        action: "Device Revoked",
                        details: `Peranti ${devName} dilog keluar oleh ${currentDev}`,
                        timestamp: Date.now()
                    })
                });

                currentUserData.security.devices = newDevices;
                openDeviceManagement();
                showToast("Device revoked securely.", "success");
            } catch (e) {
                showToast(e.message, "error");
            }
            hideGlobalLoader();
        };

        window.removeAllOtherDevices = async function() {
            showGlobalLoader("Securing session limits...");
            try {
                const currentDev = getDeviceName();
                await updateDoc(doc(db, "users", currentUserDocId), {
                    "security.devices": [currentDev],
                    logs: arrayUnion({
                        action: "Sign Out All Devices",
                        details: `Semua peranti lain dilog keluar secara serentak oleh ${currentDev}`,
                        timestamp: Date.now()
                    })
                });
                currentUserData.security.devices = [currentDev];
                openDeviceManagement();
                showToast("All remote devices have been securely signed out.", "success");
            } catch (e) {
                showToast(e.message, "error");
            }
            hideGlobalLoader();
        };

        onAuthStateChanged(auth, async (user) => {
            if (user && user.emailVerified) {
                showGlobalLoader("Loading your account...");
                try {
                    const q = query(collection(db, "users"), where("uid", "==", user.uid));
                    const snap = await getDocs(q);

                    if (!snap.empty) {
                        currentUserDocId = snap.docs[0].id;
                        currentUserData = snap.docs[0].data();

                        const currentDevice = getDeviceName();
                        let devicesArr = currentUserData.security?.devices || [];
                        if (!devicesArr.includes(currentDevice)) devicesArr.push(currentDevice);

                        await updateDoc(doc(db, "users", currentUserDocId), {
                            "security.lastLogin": Date.now(),
                            "security.sessionActive": true,
                            "security.devices": devicesArr
                        });
                        currentUserData.security.devices = devicesArr;

                        if (sessionListener) sessionListener();
                        sessionListener = onSnapshot(doc(db, "users", currentUserDocId), async (docSnap) => {
                            if (!docSnap.exists()) return;
                            const data = docSnap.data();

                            if (data.security?.revokeEvent && data.security.revokeEvent.revokedDevice === currentDevice) {
                                const revokedBy = data.security.revokeEvent.revokedBy;
                                await updateDoc(doc(db, "users", currentUserDocId), {
                                    "security.revokeEvent": null
                                });
                                alert(`Anda terkeluar dari akaun kerana di log out oleh ${revokedBy}`);
                                await signOut(auth);
                                window.location.reload();
                            } else if (data.security?.devices && !data.security.devices.includes(currentDevice)) {
                                alert(`Anda terkeluar dari akaun kerana sesi ditamatkan oleh peranti utama.`);
                                await signOut(auth);
                                window.location.reload();
                            }
                        });

                        navigate('dashboard');

                        const btn = document.getElementById('btn-login');
                        if (btn) {
                            btn.innerHTML = 'Sign In';
                            btn.disabled = false;
                        }
                    }
                } catch (e) {
                    console.error("Dashboard fetch error", e);
                    showToast("Failed to construct dashboard.", "error");
                }
                setTimeout(() => hideGlobalLoader(), 500);
            } else {
                currentUserDocId = null;
                currentUserData = null;
                if (sessionListener) sessionListener();
                clearInterval(verifyPollInterval);
                if (document.getElementById('dashboard-group').classList.contains('hidden') === false || document.getElementById('view-home').classList.contains('hidden') === false) {
                    navigate('home');
                }
            }
        });

        function renderDashboardTime() {
            const h = new Date().getHours();
            const iconEl = document.getElementById('dash-time-icon');
            let greeting = "Good Night";

            if (h >= 5 && h < 12) {
                greeting = "Good Morning";
                iconEl.innerHTML = `<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>`;
            } else if (h >= 12 && h < 18) {
                greeting = "Good Afternoon";
                iconEl.innerHTML = `<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>`;
            } else {
                greeting = "Good Evening";
                iconEl.innerHTML = `<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>`;
            }
            return greeting;
        }

        async function loadDashboard() {
            if (!auth.currentUser || !currentUserData) return;

            const gText = renderDashboardTime();
            document.getElementById('dash-greeting').innerHTML = `${gText},<br>${currentUserData.profile.displayName}`;
            document.getElementById('dash-username').innerText = `@${currentUserData.profile.username}`;
            document.getElementById('dash-session-count').innerText = `${currentUserData.security.devices?.length || 1} devices`;

            try {
                const lSnap = await getDoc(doc(db, "profile_change_lock", currentUserDocId));
                if (lSnap.exists() && lSnap.data().lockUntil > Date.now()) {
                    isChangeLocked = true;
                    document.getElementById('lock-warning').classList.remove('hidden');
                } else {
                    isChangeLocked = false;
                    document.getElementById('lock-warning').classList.add('hidden');
                }
            } catch (e) {
                console.warn(e);
            }
        }

        window.openAction = function(type) {
            if (isChangeLocked && type !== 'security' && type !== 'logdata') return showToast("Modifications are locked during the 24h cooldown.", "error");

            showGlobalLoader("Loading module...");
            setTimeout(() => {
                hideGlobalLoader();
                if (type === 'name') {
                    document.getElementById('change-name-input').value = currentUserData.profile.displayName;
                    document.getElementById('preview-name-before').innerText = currentUserData.profile.displayName;
                    document.getElementById('preview-name-after').innerText = currentUserData.profile.displayName;
                    openModal('modal-name');
                } else if (type === 'email') {
                    openModal('modal-email');
                } else if (type === 'password') {
                    openModal('modal-password');
                } else if (type === 'username') {
                    document.getElementById('change-username-input').value = currentUserData.profile.username;
                    document.getElementById('new-username-status').innerHTML = '';
                    openModal('modal-username');
                } else if (type === 'security') {
                    openModal('modal-security');
                } else if (type === 'logdata') {
                    document.getElementById('logdata-auth-section').classList.remove('hidden');
                    document.getElementById('logdata-content-section').classList.add('hidden');
                    document.getElementById('logdata-password').value = '';
                    openModal('modal-logdata');
                }
            }, 400);
        };

        window.previewNameChange = function() {
            const val = document.getElementById('change-name-input').value || currentUserData.profile.displayName;
            document.getElementById('preview-name-after').innerText = val;
        };

        window.submitChangeName = async function() {
            const val = document.getElementById('change-name-input').value.trim();
            if (val.length < 2) return showToast("Profile name must be longer.", "error");
            showGlobalLoader("Updating your profile...");
            try {
                await updateDoc(doc(db, "users", currentUserDocId), {
                    "profile.displayName": val,
                    "profile.lastUpdated": Date.now(),
                    logs: arrayUnion({
                        action: "Profile Name Changed",
                        details: `Tukar dari ${currentUserData.profile.displayName} kepada ${val}`,
                        timestamp: Date.now()
                    })
                });
                currentUserData.profile.displayName = val;
                loadDashboard();
                closeModal();
                showToast("Profile updated successfully.", "success");
            } catch (e) {
                showToast(e.message, "error");
            }
            hideGlobalLoader();
        };

        window.submitChangeEmail = async function() {
            const val = document.getElementById('change-email-input').value.trim();
            if (!val.includes('@')) return showToast("Invalid email formulation.", "error");

            const btn = document.getElementById('btn-submit-change-email');
            btn.innerHTML = '<div class="spinner" style="width:16px; height:16px; border-width:2px; margin-right:8px;"></div> Dispatching...';
            btn.disabled = true;

            try {
                // 1. Hantar emel pengesahan ke emel baru
                await verifyBeforeUpdateEmail(auth.currentUser, val);
                showToast("Secure verification link dispatched to new email. After your Email Has Been Verified and Changed, We will Sign you out and you Must Re Sign In with your new email.", "success");
                btn.classList.add('hidden');

                const resendBtn = document.getElementById('btn-resend-change-email');
                resendBtn.classList.remove('hidden');
                resendBtn.disabled = true;

                // Timer resend
                let t = 30;
                const span = document.getElementById('change-email-timer');
                const int = setInterval(() => {
                    t--;
                    span.innerText = t;
                    if (t <= 0) {
                        clearInterval(int);
                        resendBtn.disabled = false;
                    }
                }, 1000);

                // 2. Polling untuk check status pengesahan
                let verifyPollEmailInterval = setInterval(async () => {
                    await auth.currentUser.reload();

                    // Check jika emel sudah bertukar di Firebase
                    if (auth.currentUser.email === val) {
                        clearInterval(verifyPollEmailInterval);

                        // Update Firestore
                        await updateDoc(doc(db, "users", currentUserDocId), {
                            "auth.email": val,
                            logs: arrayUnion({
                                action: "Email Address Changed",
                                details: `Tukar dari ${currentUserData.auth.email} kepada ${val}`,
                                timestamp: Date.now()
                            })
                        });

                        currentUserData.auth.email = val;
                        closeModal(); // Tutup modal terus supaya pengguna tak keliru

                        // 3. Inform pengguna dan Logout
                        showToast("Your New Email Has Been Verified and Changed!.", "success");

                        setTimeout(async () => {
                            window.location.reload(); // Refresh untuk balik ke skrin login
                        }, 5000); // Tunggu 5 saat untuk pengguna baca toast
                    }
                }, 3000);

            } catch (e) {
                if (e.code === 'auth/requires-recent-login') {
                    showToast("Security Timeout: Please sign out and sign back in to perform this sensitive action.", "error");
                } else {
                    showToast(e.message, "error");
                }
                btn.innerHTML = 'Send Verification Link';
                btn.disabled = false;
            }
        };

        window.submitChangePassword = async function() {
            showGlobalLoader("Preparing secure link...");
            try {
                await sendPasswordResetEmail(auth, currentUserData.auth.email);
                await updateDoc(doc(db, "users", currentUserDocId), {
                    logs: arrayUnion({
                        action: "Password Reset Requested",
                        details: `Pautan reset password dihantar ke emel`,
                        timestamp: Date.now()
                    })
                });
                showToast("Secure token dispatched to your email.", "success");
                closeModal();
            } catch (e) {
                showToast(e.message, "error");
            }
            hideGlobalLoader();
        };

        window.checkNewUsernameLive = async function() {
            const val = document.getElementById('change-username-input').value.trim();
            const stat = document.getElementById('new-username-status');
            const btn = document.getElementById('btn-submit-username');
            btn.style.opacity = '0.5';
            btn.style.pointerEvents = 'none';

            if (val === currentUserData.profile.username) return stat.innerHTML = '<span style="color:var(--accent-orange); display:flex; align-items:center; justify-content:center; gap:6px;"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg> This is your current identifier</span>';
            if (val.length < 6 || val.includes(' ')) return stat.innerHTML = '<span style="color:var(--error-color); display:flex; align-items:center; justify-content:center; gap:6px;"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg> Invalid architecture format</span>';

            stat.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; gap:8px; color:var(--text-muted);"><div class="spinner" style="width:14px; height:14px; border-width:2px; border-top-color:var(--text-main);"></div> Scanning network...</div>';

            try {
                const docSnap = await getDoc(doc(db, "users", val));
                if (!docSnap.exists()) {
                    stat.innerHTML = '<span style="color:var(--success-color); display:flex; align-items:center; justify-content:center; gap:6px;"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Identifier available</span>';
                    btn.style.opacity = '1';
                    btn.style.pointerEvents = 'auto';
                } else {
                    stat.innerHTML = '<span style="color:var(--error-color); display:flex; align-items:center; justify-content:center; gap:6px;"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg> Identifier occupied</span>';
                }
            } catch (e) {
                stat.innerHTML = '<span style="color:var(--success-color); display:flex; align-items:center; justify-content:center; gap:6px;"><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Available (Network Bypass)</span>';
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
            }
        };

        window.submitChangeUsername = async function() {
            const val = document.getElementById('change-username-input').value.trim();
            showGlobalLoader("Migrating account details...");

            try {
                const oldDocRef = doc(db, "users", currentUserDocId);
                const newDocRef = doc(db, "users", val);

                let newData = {
                    ...currentUserData
                };
                newData.profile.username = val;
                newData.profile.lastUpdated = Date.now();

                if (!newData.logs) newData.logs = [];
                newData.logs.push({
                    action: "Username Migrated",
                    details: `Tukar dari ${currentUserData.profile.username} kepada ${val}`,
                    timestamp: Date.now()
                });

                await setDoc(newDocRef, newData);
                await deleteDoc(oldDocRef);

                const oldLockRef = doc(db, "profile_change_lock", currentUserDocId);
                const newLockRef = doc(db, "profile_change_lock", val);
                const lockSnap = await getDoc(oldLockRef);
                if (lockSnap.exists()) {
                    await setDoc(newLockRef, lockSnap.data());
                    await deleteDoc(oldLockRef);
                }

                currentUserDocId = val;
                currentUserData = newData;

                loadDashboard();
                closeModal();
                showToast("Global Identity successfully migrated.", "success");
            } catch (e) {
                showToast("Migration failure: " + e.message, "error");
            }

            hideGlobalLoader();
        };

        window.verifyLogDataPassword = async function() {
            const pass = document.getElementById('logdata-password').value;
            if (!pass) return showToast("Sila masukkan kata laluan.", "error");

            const btn = document.getElementById('btn-verify-logdata');
            btn.innerHTML = '<div class="spinner" style="width:16px; height:16px; border-width:2px;"></div> Mengesahkan...';
            btn.disabled = true;

            try {
                const credential = EmailAuthProvider.credential(currentUserData.auth.email, pass);
                await reauthenticateWithCredential(auth.currentUser, credential);

                const docSnap = await getDoc(doc(db, "users", currentUserDocId));
                const rawData = docSnap.exists() ? docSnap.data() : currentUserData;

                document.getElementById('logdata-auth-section').classList.add('hidden');
                document.getElementById('logdata-content-section').classList.remove('hidden');
                document.getElementById('logdata-raw-json').textContent = JSON.stringify(rawData, null, 4);
                showToast("Authentication success, showing raw log data....", "success");
            } catch (e) {
                showToast("Kata laluan tidak sah atau sambungan ralat.", "error");
            }

            btn.innerHTML = 'Sahkan Identiti';
            btn.disabled = false;
        };

        // Init
        navigate('home');
