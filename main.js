import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, increment } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCAsD8wucLsudzY5oNbiixLGyjN2apdV0Q",
    authDomain: "my-ad-analytics-4560a.firebaseapp.com",
    databaseURL: "https://my-ad-analytics-4560a-default-rtdb.firebaseio.com",
    projectId: "my-ad-analytics-4560a",
    storageBucket: "my-ad-analytics-4560a.firebasestorage.app",
    messagingSenderId: "104213283950",
    appId: "1:104213283950:web:b5a25ecd54df809625127f",
    measurementId: "G-WS7QSQ9H0Y"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.container');
    const categoryButtons = document.querySelectorAll('.category-bar button:not(.add-card-btn)');
    const addCardBtn = document.querySelector('.add-card-btn');
    const authModal = document.getElementById('authModal');
    const passwordInput = document.getElementById('passwordInput');
    const authSubmit = document.getElementById('authSubmit');
    const addCardForm = document.getElementById('addCardForm');
    const cardTitleInput = document.getElementById('cardTitle');
    // const cardImageInput = document.getElementById('cardImage'); // **** পরিবর্তন: এই লাইনটি মুছে ফেলা হয়েছে ****
    const cardEmbedCodeInput = document.getElementById('cardEmbedCode');
    const cardCategorySelect = document.getElementById('cardCategory');
    const codeResultDiv = document.getElementById('codeResult');
    const cardCodeBox = document.getElementById('cardCodeBox');
    const copyCardCodeBtn = document.getElementById('copyCardCodeBtn');
    const notificationPopup = document.getElementById('notificationPopup');
    const cardCodeNotification = document.getElementById('cardCodeNotification');
    const manualCopyInstruction = document.getElementById('manualCopyInstruction');
    const backBtn = document.getElementById('backBtn');
    const restartBtn = document.getElementById('restartBtn');
    const bottomSection = document.getElementById('bottom-section');
    
    const password = 'fuck';
    let wrongPasswordCount = 0;
    const lockoutDuration = 5 * 60 * 1000;

    const mainContent = document.getElementById('main-content');
    const adminPanelFull = document.getElementById('admin-panel-full');
    const loadingBar = document.getElementById('loading-bar');
    
    let allCardData = [];
    let filteredCards = [];
    let cardsLoaded = 0;
    const cardsPerLoad = 10;
    const loadingSentinel = document.getElementById('loading-sentinel');
    let currentFilter = 'all';
    let currentCardToHighlight = null;
    let observer;

    const cardsPerPage = 20;
    let currentPage = 1;
    let totalPages = 1;
    
    let highlightTimerTimeout = null;
    const HIGHLIGHT_KEY = 'highlightCardId';
    const END_TIME_KEY = 'highlightEndTime';
    const HIGHLIGHT_DURATION = 10000;
    
    function getDeviceId() {
        let deviceId = localStorage.getItem('deviceId');
        if (!deviceId) {
            deviceId = 'device-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('deviceId', deviceId);
        }
        return deviceId;
    }

    const deviceId = getDeviceId();
    
    function formatTimeAgo(timestamp) {
        const uploadDate = new Date(timestamp);
        const now = new Date();
        const seconds = Math.floor((now - uploadDate) / 1000);
    
        let interval = seconds / 31536000;
        if (interval > 1) {
            return Math.floor(interval) + " বছর আগে";
        }
        interval = seconds / 2592000;
        if (interval > 1) {
            return Math.floor(interval) + " মাস আগে";
        }
        interval = seconds / 86400;
        if (interval > 1) {
            return Math.floor(interval) + " দিন আগে";
        }
        interval = seconds / 3600;
        if (interval > 1) {
            return Math.floor(interval) + " ঘন্টা আগে";
        }
        interval = seconds / 60;
        if (interval > 1) {
            return Math.floor(interval) + " মিনিট আগে";
        }
        return "এখনই";
    }
    
    function formatCount(num) {
        if (num >= 1000000000) {
            return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
        }
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        }
        return num;
    }

    async function getAndUpdateStats(cardId, cardElement) {
        try {
            const viewsDocRef = doc(db, "views", cardId);
            const viewsDocSnap = await getDoc(viewsDocRef);
            let viewCount = 0;
            if (viewsDocSnap.exists()) {
                viewCount = viewsDocSnap.data().count;
            }
            
            const lovesDocRef = doc(db, "loves", cardId);
            const lovesDocSnap = await getDoc(lovesDocRef);
            let loveCount = 0;
            if (lovesDocSnap.exists()) {
                loveCount = lovesDocSnap.data().count;
            }

            const userLikedDocRef = doc(db, `loves/${cardId}/users`, deviceId);
            const userLikedDocSnap = await getDoc(userLikedDocRef);
            const loveButton = cardElement.querySelector('.love-stats');

            const viewElement = cardElement.querySelector('.view-stats .count');
            const loveElement = cardElement.querySelector('.love-stats .count');
            
            if (viewElement) viewElement.textContent = formatCount(viewCount);
            if (loveElement) loveElement.textContent = formatCount(loveCount);

            if (userLikedDocSnap.exists()) {
                loveButton.classList.add('liked');
            } else {
                loveButton.classList.remove('liked');
            }
            
            loveButton.classList.remove('disabled');

        } catch (error) {
            console.error("Error fetching stats:", error);
            const viewElement = cardElement.querySelector('.view-stats .count');
            const loveElement = cardElement.querySelector('.love-stats .count');
            const loveButton = cardElement.querySelector('.love-stats');

            if (viewElement) viewElement.textContent = 'Error';
            if (loveElement) loveElement.textContent = 'Error';
            
            loveButton.classList.add('disabled');
            loveButton.style.cursor = 'not-allowed';
        }
    }

    async function loadData() {
        loadingBar.style.width = '20%';
        try {
            const response = await fetch('cards.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            loadingBar.style.width = '60%';
            const data = await response.json();
            loadingBar.style.width = '80%';
            allCardData = data;
            
            filterAndLoadCards(currentFilter);
            
            loadingBar.style.width = '100%';
            setTimeout(() => {
                loadingBar.style.width = '0%';
            }, 500);
            
            setInterval(updateCardTimes, 60000);
            
        } catch (error) {
            console.error('Error loading card data:', error);
            showNotification('Error loading data. Please try again later.');
            loadingBar.style.width = '0%';
        }
    }
    
    function updateCardTimes() {
        document.querySelectorAll('.card').forEach(card => {
            const uploadTime = card.dataset.uploadTime;
            if (uploadTime) {
                const timeAgoText = formatTimeAgo(uploadTime);
                const timeElement = card.querySelector('.card-upload-time');
                if (timeElement) {
                    timeElement.textContent = timeAgoText;
                }
            }
        });
    }

    function showNotification(message, duration = 3000, target = notificationPopup) {
        target.textContent = message;
        target.classList.add('show');
        setTimeout(() => {
            target.classList.remove('show');
        }, duration);
    }
    
    function generateUniqueId() {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    function createCard(data) {
        const card = document.createElement('div');
        card.classList.add('card');
        card.setAttribute('data-id', data.id);
        card.setAttribute('data-video-link', data.videoLink);
        card.setAttribute('data-category', data.category.join(','));
        if (data.uploadTime) {
            card.setAttribute('data-upload-time', data.uploadTime);
        }
        
        const timeAgoText = data.uploadTime ? formatTimeAgo(data.uploadTime) : '';
        
        card.innerHTML = `
            <div class="card-header">
                 <div class="share-icon" data-id="${data.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-box-arrow-up" viewBox="0 0 16 16">
                        <path fill-rule="evenodd" d="M3.5 6a.5.5 0 0 0-.5.5v8a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5v-8a.5.5 0 0 0-.5-.5h-2a.5.5 0 0 1 0-1h2A1.5 1.5 0 0 1 14 6.5v8a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 14.5v-8A1.5 1.5 0 0 1 3.5 5h2a.5.5 0 0 1 0 1h-2z"/>
                        <path fill-rule="evenodd" d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V9.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/>
                    </svg>
                </div>
                <div class="card-upload-time">${timeAgoText}</div>
                <div class="card-image-container">
                    <img src="${data.image}" alt="${data.title}" loading="lazy">
                    <div class="play-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
                        </svg>
                    </div>
                </div>
            </div>
            <div class="card-content">
                <h3 class="card-title">${data.title}</h3>
                <hr class="card-divider">
            </div>
            <div class="card-footer">
                <div class="card-stats view-stats">
                    <svg class="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                    <span class="count"><div class="loader"></div></span>
                </div>
                <div class="card-stats love-stats disabled" data-id="${data.id}">
                    <svg class="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6c757d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-heart">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                    <span class="count"><div class="loader"></div></span>
                </div>
            </div>`;
        
        return card;
    }

    function renderCards(start, end, clear = false) {
        if (clear) {
            container.innerHTML = '';
        }
        
        const cardsToRender = filteredCards.slice(start, end);
        
        cardsToRender.forEach(data => {
            const card = createCard(data);
            container.appendChild(card);
            getAndUpdateStats(data.id, card);
            setTimeout(() => {
                 card.classList.add('visible');
                 if (data.id === currentCardToHighlight) {
                    card.classList.add('highlighted');
                     
                     setTimeout(() => {
                         const headerHeight = document.querySelector('.header').offsetHeight;
                         const viewportHeight = window.innerHeight;
                         const cardTop = card.getBoundingClientRect().top;
                         const scrollPosition = window.scrollY + cardTop - (viewportHeight / 2) + (card.offsetHeight / 2) + (headerHeight / 2);

                         window.scrollTo({
                             top: scrollPosition,
                             behavior: 'smooth'
                         });
                     }, 200);
                 }
            }, 50); 
        });
        
        cardsLoaded = end;
    }
    
    function filterAndLoadCards(filterCategory) {
        currentFilter = filterCategory;
        if (filterCategory === 'all') {
            filteredCards = allCardData;
        } else {
            filteredCards = allCardData.filter(card => card.category.includes(filterCategory));
        }
        
        totalPages = Math.ceil(filteredCards.length / cardsPerPage);
        currentPage = 1;
        
        const targetCardIndex = filteredCards.findIndex(card => card.id === currentCardToHighlight);
        
        if (targetCardIndex !== -1) {
            const targetPage = Math.floor(targetCardIndex / cardsPerPage) + 1;
            currentPage = targetPage;
            loadPage(targetPage, targetCardIndex);
        } else {
            loadPage(currentPage);
        }
    }

    function loadPage(pageNumber, highlightIndex = -1) {
        currentPage = pageNumber;
        cardsLoaded = 0; 
        
        const startCardIndex = (currentPage - 1) * cardsPerPage;
        const endOfPage = Math.min(startCardIndex + cardsPerPage, filteredCards.length);
        const totalCardsToLoad = endOfPage - startCardIndex;
        
        container.innerHTML = '';
        
        if (highlightIndex !== -1 && highlightIndex >= startCardIndex) {
            const loadUntil = highlightIndex + 1;
            renderCards(startCardIndex, loadUntil, true);
            cardsLoaded = loadUntil - startCardIndex;
            
            if (endOfPage > loadUntil) {
                observer.observe(loadingSentinel);
            } else {
                observer.unobserve(loadingSentinel);
            }
        } 
        else if (totalCardsToLoad <= cardsPerLoad) {
            renderCards(startCardIndex, endOfPage, true);
            cardsLoaded = totalCardsToLoad;
            observer.unobserve(loadingSentinel);
        } 
        else {
            renderCards(startCardIndex, startCardIndex + cardsPerLoad, true);
            cardsLoaded = cardsPerLoad;
            observer.observe(loadingSentinel);
        }

        renderPaginationButtons();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    function loadMoreCards() {
        const startCardIndex = (currentPage - 1) * cardsPerPage + cardsLoaded;
        const endCardIndex = Math.min((currentPage - 1) * cardsPerPage + cardsLoaded + cardsPerLoad, (currentPage * cardsPerPage));

        if (startCardIndex < endCardIndex) {
            renderCards(startCardIndex, endCardIndex, false);
            
            if (endCardIndex === (currentPage * cardsPerPage) || endCardIndex === filteredCards.length) {
                 observer.unobserve(loadingSentinel);
            }
        } else {
             observer.unobserve(loadingSentinel);
        }
    }
    
    function renderPaginationButtons() {
        const paginationContainer = document.getElementById('pagination-container');
        paginationContainer.innerHTML = ''; 
        
        if (totalPages <= 1) {
            bottomSection.classList.remove('visible');
            return;
        }

        const prevBtn = document.createElement('button');
        prevBtn.classList.add('pagination-button', 'prev-next');
        prevBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-chevron-left" viewBox="0 0 16 16">
              <path fill-rule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
            </svg>
        `;
        prevBtn.disabled = currentPage === 1;
        prevBtn.addEventListener('click', () => loadPage(currentPage - 1));
        paginationContainer.appendChild(prevBtn);

        const maxButtonsToShow = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxButtonsToShow / 2));
        let endPage = Math.min(totalPages, startPage + maxButtonsToShow - 1);
        
        if (endPage - startPage + 1 < maxButtonsToShow) {
            startPage = Math.max(1, endPage - maxButtonsToShow + 1);
        }

        if (startPage > 1) {
            const firstPageBtn = document.createElement('button');
            firstPageBtn.textContent = '1';
            firstPageBtn.classList.add('pagination-button');
            firstPageBtn.addEventListener('click', () => loadPage(1));
            paginationContainer.appendChild(firstPageBtn);

            if (startPage > 2) {
                const dots = document.createElement('span');
                dots.textContent = '...';
                paginationContainer.appendChild(dots);
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.textContent = i;
            pageBtn.classList.add('pagination-button');
            if (i === currentPage) {
                pageBtn.classList.add('active');
            }
            pageBtn.addEventListener('click', () => loadPage(i));
            paginationContainer.appendChild(pageBtn);
        }

        if (endPage < totalPages) {
             if (endPage < totalPages - 1) {
                const dots = document.createElement('span');
                dots.textContent = '...';
                paginationContainer.appendChild(dots);
            }
            const lastPageBtn = document.createElement('button');
            lastPageBtn.textContent = totalPages;
            lastPageBtn.classList.add('pagination-button');
            lastPageBtn.addEventListener('click', () => loadPage(totalPages));
            paginationContainer.appendChild(lastPageBtn);
        }
        
        const nextBtn = document.createElement('button');
        nextBtn.classList.add('pagination-button', 'prev-next');
        nextBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-chevron-right" viewBox="0 0 16 16">
              <path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
            </svg>
        `;
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.addEventListener('click', () => loadPage(currentPage + 1));
        paginationContainer.appendChild(nextBtn);

        updatePaginationButtons();
        
        observer.unobserve(bottomSection); 
        if (totalPages > 1) {
            observer.observe(bottomSection); 
        }
    }

    function updatePaginationButtons() {
        const paginationContainer = document.getElementById('pagination-container');
        const buttons = paginationContainer.querySelectorAll('.pagination-button');
        buttons.forEach(button => {
            button.classList.remove('active');
            if (button.textContent == currentPage) {
                button.classList.add('active');
            }
        });
    }
    
    observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.target === loadingSentinel && entry.isIntersecting) {
                loadMoreCards();
            }
            
            if (entry.target === bottomSection) {
                if (entry.isIntersecting) {
                     bottomSection.classList.add('visible');
                } else {
                     bottomSection.classList.remove('visible'); 
                }
            }
        });
    }, {
        root: null,
        rootMargin: '0px 0px 0px 0px', 
        threshold: 0.01
    });
    
    function manageHighlight() {
        const urlParams = new URLSearchParams(window.location.search);
        const urlCardId = urlParams.get('cardId');
        
        if (urlCardId) {
            // যদি URL এ cardId থাকে, তবে সেটি হাইলাইট করার জন্য লোকাল স্টোরেজে সেট করবে
            const endTime = new Date(Date.now() + HIGHLIGHT_DURATION).toISOString();
            localStorage.setItem(HIGHLIGHT_KEY, urlCardId);
            localStorage.setItem(END_TIME_KEY, endTime);
        }
        
        const activeCardId = localStorage.getItem(HIGHLIGHT_KEY);
        const endTime = localStorage.getItem(END_TIME_KEY);

        if (highlightTimerTimeout) {
            clearTimeout(highlightTimerTimeout);
        }

        if (!activeCardId || !endTime) {
            currentCardToHighlight = null;
            return;
        }

        const remainingTime = new Date(endTime).getTime() - Date.now();

        if (remainingTime > 0) {
            currentCardToHighlight = activeCardId;

            highlightTimerTimeout = setTimeout(() => {
                document.querySelectorAll('.card.highlighted').forEach(card => {
                    card.classList.remove('highlighted');
                });
                localStorage.removeItem(HIGHLIGHT_KEY);
                localStorage.removeItem(END_TIME_KEY);
                currentCardToHighlight = null;
                showNotification('Card highlight ended.', 2000);
            }, remainingTime);

            // URL থেকে cardId প্যারামিটার মুছে ফেলার লজিক
            if (window.location.search.includes('cardId=')) {
                 if (window.history.replaceState) {
                     const cleanUrl = window.location.pathname + window.location.search.replace(/([?&])cardId=[^&]+(&|$)/, '$1').replace(/[?&]$/, '');
                     window.history.replaceState({path: cleanUrl}, '', cleanUrl);
                 }
            }

        } else {
            localStorage.removeItem(HIGHLIGHT_KEY);
            localStorage.removeItem(END_TIME_KEY);
            currentCardToHighlight = null;
        }
    }

    container.addEventListener('click', async (event) => {
        const card = event.target.closest('.card');
        const imageContainer = event.target.closest('.card-image-container');
        const shareIcon = event.target.closest('.share-icon');
        const loveStats = event.target.closest('.love-stats');

        if (shareIcon) {
            const cardId = shareIcon.dataset.id;
            const cardTitle = card.querySelector('.card-title').textContent;
            const shareUrl = `${window.location.origin}${window.location.pathname}?cardId=${cardId}`;
            
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: cardTitle,
                        text: `${cardTitle} ভাইরাল ভিডিওটি দেখতে 👇 লিংকে ক্লিক করুন!`,
                        url: shareUrl,
                    });
                    showNotification('Card shared!', 2000, notificationPopup);
                } catch (error) {
                    console.error('Sharing failed:', error);
                }
            } else {
                copyToClipboard(shareUrl, notificationPopup);
            }
            return;
        }
        
        if (loveStats) {
            if (loveStats.classList.contains('disabled')) {
                return; 
            }
            const cardId = loveStats.dataset.id;
            const userLikedDocRef = doc(db, `loves/${cardId}/users`, deviceId);
            
            try {
                const docSnap = await getDoc(userLikedDocRef);
                if (docSnap.exists()) {
                    showNotification("You have already loved this card!", 3000);
                } else {
                    await setDoc(doc(db, "loves", cardId), { count: increment(1) }, { merge: true });
                    await setDoc(userLikedDocRef, { timestamp: new Date() });
                    showNotification("Thanks for loving this card!", 2000);
                    
                    const cardElement = event.target.closest('.card');
                    getAndUpdateStats(cardId, cardElement);
                }
            } catch (error) {
                console.error("Error updating love count:", error);
                showNotification("Failed to update love count. Please try again.", 3000);
            }
            return;
        }

        if (imageContainer && card) {
            const cardId = card.dataset.id;
            
            window.location.href = `https://jibonpoth2.blogspot.com/?cardId=${cardId}`;
        }
    });

    categoryButtons.forEach(button => {
        button.addEventListener('click', () => {
            categoryButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const category = button.getAttribute('data-category');
            currentCardToHighlight = null;
            filterAndLoadCards(category);
        });
    });

    addCardBtn.addEventListener('click', () => {
        authModal.classList.add('show');
        passwordInput.value = '';
        passwordInput.focus();
    });

    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            authModal.classList.remove('show');
        });
    });
    
    authSubmit.addEventListener('click', () => {
        const userPassword = passwordInput.value;
        if (userPassword === password) {
            authModal.classList.remove('show');
            mainContent.style.display = 'none';
            adminPanelFull.classList.add('show');
            wrongPasswordCount = 0;
        } else {
            wrongPasswordCount++;
            showNotification('Only for Admin');
            passwordInput.value = '';
            if (wrongPasswordCount >= 3) {
                authModal.classList.remove('show');
                addCardBtn.style.display = 'none';
                setTimeout(() => {
                    addCardBtn.style.display = 'flex';
                    wrongPasswordCount = 0;
                }, lockoutDuration);
            }
        }
    });
    
    backBtn.addEventListener('click', () => {
        adminPanelFull.classList.remove('show');
        mainContent.style.display = 'block';
        addCardForm.reset();
        codeResultDiv.style.display = 'none';
    });
    
    restartBtn.addEventListener('click', () => {
        addCardForm.reset();
        codeResultDiv.style.display = 'none';
        showNotification('Form has been reset.', 2000, notificationPopup);
    });

    addCardForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = cardTitleInput.value;
        // const image = cardImageInput.value; 
        const embedCode = cardEmbedCodeInput.value;
        const category = cardCategorySelect.value;
        const newId = generateUniqueId();
        const currentTime = new Date().toISOString();

        // **** পরিবর্তন: Bitchute ID বের করা এবং থাম্বনেল URL তৈরি করার লজিক ****
        let videoId = '';
        // Bitchute embed/video কোড থেকে আইডি বের করার জন্য regex
        const regex = /bitchute\.com\/(?:embed|video)\/([a-zA-Z0-9_-]+)/i;
        const match = embedCode.match(regex);

        if (match && match[1]) {
            videoId = match[1];
        } else {
            showNotification('Invalid Bitchute Embed Code! Could not find Video ID.', 4000, cardCodeNotification);
            codeResultDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return; 
        }
        
        // আপনার খুঁজে বের করা স্থিতিশীল Bitchute থাম্বনেল কাঠামো:
        // স্থির অংশ: Path Prefix (কভার আইডি সহ)
        const URL_PREFIX = "https://static-3.bitchute.com/live/cover_images/LfoeJFMiC2SB/";
        // স্থির অংশ: Path Suffix (রেজোলিউশন সহ)
        const URL_SUFFIX = "_1280x720.jpg"; 
        
        // সম্পূর্ণ থাম্বনেল ইউআরএল জেনারেট করা হলো
        const thumbnailUrl = URL_PREFIX + videoId + URL_SUFFIX;
        // *************************************************************************

        const escapedEmbedCode = embedCode.replace(/"/g, '\\"');
       
        const newCardCode = `{
    "id": "${newId}",
    "title": "${title}",
    "image": "${thumbnailUrl}",
    "embed_code": "${escapedEmbedCode}",
    "category": ["${category}"],
    "uploadTime": "${currentTime}"
},`;
        
        cardCodeBox.textContent = newCardCode.trim();
        codeResultDiv.style.display = 'block';
        codeResultDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    
    async function copyToClipboard(text, notificationEl) {
        try {
            await navigator.clipboard.writeText(text);
            showNotification('Link copied to clipboard!', 2000, notificationEl);
            manualCopyInstruction.style.display = 'none';
        } catch (err) {
            console.error('Failed to copy text: ', err);
            showNotification('Failed to copy.', 2000, notificationEl);
            manualCopyInstruction.style.display = 'block';
        }
    }

    copyCardCodeBtn.addEventListener('click', () => {
        copyToClipboard(cardCodeBox.textContent, cardCodeNotification);
    });

    window.addEventListener('click', (event) => {
        if (event.target == authModal) {
            authModal.classList.remove('show');
        }
    });
    
    function init() {
        // manageHighlight() ফাংশনের পূর্বে URL থেকে cardId প্যারামিটারটি চেক করা
        const urlParams = new URLSearchParams(window.location.search);
        const urlCardId = urlParams.get('cardId');
        
        if (urlCardId) {
            // যদি URL এ cardId থাকে, তবে সেটি হাইলাইট করার জন্য লোকাল স্টোরেজে সেট করবে
            const endTime = new Date(Date.now() + HIGHLIGHT_DURATION).toISOString();
            localStorage.setItem(HIGHLIGHT_KEY, urlCardId);
            localStorage.setItem(END_TIME_KEY, endTime);
        }

        manageHighlight();
        
        mainContent.style.display = 'block';
        adminPanelFull.classList.remove('show');
        bottomSection.classList.remove('visible');
        
        loadData();
        observer.observe(loadingSentinel);
    }
    
    init();
});
