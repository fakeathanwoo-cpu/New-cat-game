
      // If no target or target lost, find nearest
      if (!targetPos) {
        const targets = [
          ...(bossRef.current ? [{ x: bossRef.current.x + bossRef.current.width/2, y: bossRef.current.y + bossRef.current.height/2 }] : []),
          ...obstaclesRef.current.filter(o => o.category === 'enemy').map(o => ({ x: o.x + o.width/2, y: o.y + o.height/2 }))
        ];

        if (targets.length > 0) {
          let nearest = targets[0];
          let minDist = Infinity;
          targets.forEach(t => {
            const dx = t.x - bul.x;
            const dy = t.y - bul.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) {
              minDist = dist;
              nearest = t;
            }
          });
          targetPos = nearest;
        }
      }

      if (targetPos) {
        const dx = targetPos.x - bul.x;
        const dy = targetPos.y - bul.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 5) {
          const homingStrength = 0.15;
          const speed = 25;
          bul.vx += (dx / dist * speed - bul.vx) * homingStrength;
          bul.vy = (bul.vy || 0) + (dy / dist * speed - (bul.vy || 0)) * homingStrength;
        }
      }

      bul.x += bul.vx;
      bul.y += bul.vy;

    // Collision with enemies
    for (let oIdx = obstaclesRef.current.length - 1; oIdx >= 0; oIdx--) {
      const obs = obstaclesRef.current[oIdx];
      if (obs.category === 'enemy') {
        if (
          bul.x < obs.x + obs.width &&
          bul.x + bul.width > obs.x &&
          bul.y < obs.y + obs.height &&
          bul.y + bul.height > obs.y
        ) {
          createParticles(obs.x + obs.width/2, obs.y + obs.height/2, '#00ffff', 'spark');
          createDamageText(obs.x, obs.y, 'POW!', '#00ffff');
          
          setCombo(c => {
            const next = c + 1;
            player.combo = next;
            if (next > maxCombo) setMaxCombo(next);
            return next;
          });
          
          const comboMult = 1 + Math.floor(player.combo / 5) * 0.5;
          player.score += Math.floor(100 * comboMult);
          setScore(player.score);
          
          // Cleanup Sentry Orb projectiles
            if (obs.type === 'shooter') {
              projectilesRef.current = projectilesRef.current.filter(p => p.sourceId !== obs.id);
            }
            
            obstaclesRef.current.splice(oIdx, 1);
            playerBulletsRef.current.splice(bIdx, 1);
            playProceduralSound('impact', isMuted);
            bulletRemoved = true;
            break;
          }
        }
      }
      if (bulletRemoved) continue;

      // Collision with Boss
      if (bossRef.current) {
        const boss = bossRef.current;
        if (
          bul.x < boss.x + boss.width &&
          bul.x + bul.width > boss.x &&
          bul.y < boss.y + boss.height &&
          bul.y + bul.height > boss.y
        ) {
          boss.health -= 5;
          boss.hitFlashAlpha = 1.0;
          createDamageText(bul.x, bul.y, '-5', '#00ffff');
          createParticles(bul.x, bul.y, '#00ffff', 'spark');
          playProceduralSound('impact', isMuted);
          playerBulletsRef.current.splice(bIdx, 1);
          bulletRemoved = true;
          
          if (boss.health <= 0 && !boss.isDying) {
            // Start Dramatic Boss Death Sequence
            boss.isDying = true;
            boss.deathTimer = 120; // 2 seconds of drama
            shakeOffsetRef.current = { x: 30, y: 30 };
            playProceduralSound('gameover', isMuted);
            
            // Kraken/Dino Bounty: 700,000 coins + Instant collection of all on-screen stars
            if (boss.type === 'KRAKEN' || boss.type === 'LAVA_DINO') {
              let bonusFromStars = 0;
              powerUpsRef.current = powerUpsRef.current.filter(p => {
                if (p.type === 'star') {
                  bonusFromStars += 500; // Value of a star
                  return false;
                }
                return true;
              });
              setTotalCoins(prev => prev + 700000 + bonusFromStars);
              createDamageText(boss.x + boss.width/2, boss.y - 100, `+${700000 + bonusFromStars} COINS!`, '#facc15');
            }

            // Cleanup all boss projectiles immediately
            projectilesRef.current = projectilesRef.current.filter(p => p.sourceId !== boss.id);

            // Initial massive burst
            for(let i=0; i<30; i++) {
              createParticles(boss.x + boss.width/2, boss.y + boss.height/2, '#ffffff', 'fire');
              createParticles(boss.x + boss.width/2, boss.y + boss.height/2, '#ffcc00', 'spark');
            }
          }
          break;
        }
      }
      if (bulletRemoved) continue;

      // Off-screen
      if (bul.x < -100 || bul.x > CANVAS_WIDTH + 100 || bul.y < -100 || bul.y > CANVAS_HEIGHT + 100) {
        playerBulletsRef.current.splice(bIdx, 1);
      }
    

    // Logic for things behind player
    if (player.lockedTargetId !== null) {
      const exists = obstaclesRef.current.some(o => o.id === player.lockedTargetId && o.x > -50 && o.x < CANVAS_WIDTH + 100);
      if (!exists) player.lockedTargetId = null;
    }

    if (bossRef.current && bossRef.current.hitFlashAlpha && bossRef.current.hitFlashAlpha > 0) {
      bossRef.current.hitFlashAlpha -= 0.05;
    }

    // Super Jump Logic (Removed)
    if (player.isDiving) {
      player.divingTimer--;
      const targetDivingY = GROUND_Y + 20; // Dive under ground
      player.y += (targetDivingY - player.y) * 0.2; // Smooth dive
      player.rotation = 0;
      player.vy = 0;

      // Dirt particles when under ground
      if (player.y > GROUND_Y - player.height / 2) {
        if (frameCountRef.current % 3 === 0) {
          createParticles(player.x + player.width / 2, GROUND_Y, '#8b4513', 'spark');
        }
      }

    // Impact Detection & Attack
    if (player.y >= targetDivingY - 5 && !player.hasImpacted) {
      player.hasImpacted = true;
      
      // Impact Visuals & Shake
      setShake({ x: (Math.random() - 0.5) * 30, y: (Math.random() - 0.5) * 30 });
      setTimeout(() => setShake({ x: 0, y:0 }), 150);
      
      createParticles(player.x + player.width/2, GROUND_Y, '#ffffff', 'spark');
        createParticles(player.x + player.width/2, GROUND_Y, '#ffcc00', 'spark');
        createParticles(player.x + player.width/2, GROUND_Y, '#00ccff', 'spark');
        
        // Damage Obstacles in Radius
        obstaclesRef.current = obstaclesRef.current.filter(obs => {
          const dx = (obs.x + obs.width/2) - (player.x + player.width/2);
          const dy = (obs.y + obs.height/2) - GROUND_Y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 250) {
            createParticles(obs.x + obs.width/2, obs.y + obs.height/2, '#ff4444', 'debris');
            setScore(prev => prev + 20);
            
            // Cleanup Sentry Orb projectiles
            if (obs.type === 'shooter') {
              projectilesRef.current = projectilesRef.current.filter(p => p.sourceId !== obs.id);
            }
            
            return false; // Destroy
          }
          return true;
        });
        
        // Damage Boss in Radius
        if (bossRef.current) {
          const boss = bossRef.current;
          const dx = (boss.x + boss.width/2) - (player.x + player.width/2);
          const dy = (boss.y + boss.height/2) - GROUND_Y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 350) {
            const damage = 40;
            boss.health -= damage;
            boss.hitFlashAlpha = 1.0;
            createDamageText(boss.x + boss.width/2, boss.y + boss.height/2, `CRITICAL ${damage}`, '#ffcc00');
            createParticles(boss.x + boss.width/2, boss.y + boss.height/2, '#ffcc00', 'spark');
            createParticles(boss.x + boss.width/2, boss.y + boss.height/2, '#ffffff', 'spark');
            createParticles(boss.x + boss.width/2, boss.y + boss.height/2, '#ff0000', 'spark');

            if (boss.health <= 0 && !boss.isDying) {
              boss.isDying = true;
              boss.deathTimer = 120;
              shakeOffsetRef.current = { x: 30, y: 30 };
              playProceduralSound('gameover', isMuted);
              
              // Kraken/Dino Bounty: 700,000 coins + Instant collection of all on-screen stars
              if (boss.type === 'KRAKEN' || boss.type === 'LAVA_DINO') {
                let bonusFromStars = 0;
                powerUpsRef.current = powerUpsRef.current.filter(p => {
                  if (p.type === 'star') {
                    bonusFromStars += 500;
                    return false;
                  }
                  return true;
                });
                setTotalCoins(prev => prev + 700000 + bonusFromStars);
                createDamageText(boss.x + boss.width/2, boss.y - 100, `+${700000 + bonusFromStars} COINS!`, '#facc15');
              }

              // Cleanup all boss projectiles immediately
              projectilesRef.current = projectilesRef.current.filter(p => p.sourceId !== boss.id);

              for(let i=0; i<30; i++) {
                createParticles(boss.x + boss.width/2, boss.y + boss.height/2, '#ffffff', 'fire');
                createParticles(boss.x + boss.width/2, boss.y + boss.height/2, '#ffcc00', 'spark');
              }
            }
          }
        }
      }

      if (player.divingTimer <= 0) {
        player.isDiving = false;
        player.hasImpacted = false;
      }
    } else {
      shakeOffsetRef.current = { x: 0, y: 0 };
    }

    // Player Physics
    const horizontalAcceleration = 2.0;
    const horizontalFriction = 0.82;
    const maxHorizontalSpeed = 14;

    if (gameState === 'PLAYING' && !player.isDiving) {
      let horizontalInput = 0;
      if (keysRef.current['ArrowLeft'] || keysRef.current['VirtualLeft']) {
        horizontalInput -= 1;
      }
      if (keysRef.current['ArrowRight'] || keysRef.current['VirtualRight']) {
        horizontalInput += 1;
      }
      
      // Apply Acceleration
      if (horizontalInput !== 0) {
        player.vx += horizontalInput * horizontalAcceleration;
      } else {
        player.vx *= horizontalFriction;
      }
      
      // Clamp Velocity
      player.vx = Math.max(-maxHorizontalSpeed, Math.min(maxHorizontalSpeed, player.vx));
      
      // Apply Velocity
      player.x += player.vx;

      // Dynamic tilt based on horizontal velocity
      if (Math.abs(player.vx) > 0.1 && !player.isJumping) {
        player.rotation = (player.vx / maxHorizontalSpeed) * 0.25;
      } else if (!player.isJumping) {
        player.rotation *= 0.9;
      }

    // Boundaries
    if (player.x < 0) {
      player.x = 0;
      player.vx = 0;
    }
    const maxPosX = CANVAS_WIDTH - player.width;
    if (player.x > maxPosX) {
      player.x = maxPosX;
      player.vx = 0;
    }
    
    // Gentle center pull if player goes too far right
    const safeThreshold = CANVAS_WIDTH * 0.4;
    if (player.x > safeThreshold) {
      player.x -= (player.speedCoolDown > 0 ? 8 : 0.8);
    }
    
    // Sync currentWorld/weather to ref (they change slowly, but loop needs them)
    player.currentWorld = currentWorld;
    player.weather = weather;
    player.cameraZoom = cameraZoom;
    player.timeScale = timeScale;
    player.gameState = gameState;
  }

    if (player.isDiving) {
      // Y is already handled in the diving logic block above
    } else {
      // Advanced Physics Refinement
      let currentGravity = GRAVITY;
      
      // Moon Gravity (47% less)
      if (player.currentWorld === 'COSMIC') {
        currentGravity *= 0.53;
      }
      
      // Gravity Scaling (Faster falls feel snappier)
      if (player.vy > 0) {
        currentGravity *= 1.5; 
      }
      
      // Removed Variable Jump Height as per request (fixed height jumps)

      player.vy += currentGravity;
      player.y += player.vy;

      // Coyote Time & Ground Handling
      if (player.y >= GROUND_Y - player.height) {
        if (player.vy > 5) {
           playProceduralSound('land', isMuted);
           if (selectedCharacterId === 6) {
              setShake({ x: 0, y: 15 });
              setTimeout(() => setShake({ x: 0, y: 0 }), 100);
              createParticles(player.x + player.width/2, GROUND_Y, '#8b4513', 'smoke');
           }
        }
        player.y = GROUND_Y - player.height;
        player.vy = 0;
        player.isJumping = false;
        player.canDoubleJump = true;
        player.rotation = 0;
        player.coyoteTime = 10; // Frames allowed to jump after leaving floor
      } else {
        if (player.coyoteTime > 0) player.coyoteTime--;
      }

      // Jump Buffering
      if (player.jumpBuffer > 0) {
        player.jumpBuffer--;
        if (player.y >= GROUND_Y - player.height - 5) {
          executeJump();
          player.jumpBuffer = 0;
        }
      }

      if (player.isJumping) {
        player.rotation += 0.08;
      }

      // Sky Damage Logic
      if (player.y < 0) {
        player.y = 0;
        player.vy = 2; // Bounce down slightly
        handlePlayerHit('#ff0000', 20); // Sky damage reduced to 20
      }
    }

    if (player.protectionTimer > 0) player.protectionTimer--;

    // Speed & Score
    const difficultyFactor = 1 + (score / 15000);
    let speedMultiplier = 1;

    // Moon Speed (37% slower)
    if (currentWorld === 'COSMIC') {
      speedMultiplier *= 0.63;
    }
    
    // Speed Cooldown after Super Jump
    if (player.speedCoolDown > 0) {
      player.speedCoolDown--;
      // Gradually return to normal speed (0.1x to 1.0x)
      const coolDownFactor = 0.1 + (1 - player.speedCoolDown / 180) * 0.9;
      speedMultiplier *= coolDownFactor;
    }

    // Dynamic speed based on player position (Running forward effect)
    const playerXFactor = 1 + (player.x / CANVAS_WIDTH) * 0.5; 
    const effectiveSpeed = speedRef.current * speedMultiplier * difficultyFactor * playerXFactor;
    
    speedRef.current += SPEED_INCREMENT;
    let scoreGain = 1;
    setScore(prev => {
      const newScore = prev + scoreGain;
      
      // Finish Line Logic
      if (newScore >= FINISH_SCORE - 500 && !finishLineRef.current.active) {
        finishLineRef.current.active = true;
        finishLineRef.current.x = CANVAS_WIDTH + 200;
      }
      
      // Portal Logic
      if (newScore >= 1000 && !portalRef.current.spawned && currentWorld === 'DREAM') {
        portalRef.current.spawned = true;
        portalRef.current.active = true;
        portalRef.current.x = CANVAS_WIDTH + 100;
      }
      
      return newScore;
    });

    if (portalRef.current.active) {
      portalRef.current.x -= effectiveSpeed;
      
      // Collision with Portal
      if (
        player.x < portalRef.current.x + 60 &&
        player.x + player.width > portalRef.current.x &&
        player.y < GROUND_Y &&
        player.y + player.height > 0
      ) {
        setCurrentWorld('COSMIC');
        playProceduralSound('level_up', isMuted);
        portalRef.current.active = false;
        createParticles(player.x + player.width/2, player.y + player.height/2, '#00ffff');
        speedRef.current += 1; // Slight speed boost
      }

      if (portalRef.current.x < -100) {
        portalRef.current.active = false;
      }
    }

    if (finishLineRef.current.active) {
      finishLineRef.current.x -= effectiveSpeed;
      
      // Check if player crossed finish line
      if (player.x > finishLineRef.current.x) {
        setGameState('WIN');
        setHighScore(prev => Math.max(prev, score + scoreGain));
      }
    }

    // Boss Spawning
    const currentTenThousand = Math.floor(score / 10000);
    const lastTenThousand = Math.floor(lastBossScoreRef.current / 10000);
    if (currentTenThousand > lastTenThousand && score > 0 && score >= noSpawnScoreRef.current) {
      spawnBoss();
      lastBossScoreRef.current = score;
    }

    // Weather Transition Logic
    if (frameCountRef.current % 3600 === 0) { // Every 1 min approx
      const weathers: ('sunny' | 'rainy' | 'foggy' | 'stormy')[] = ['sunny', 'rainy', 'foggy', 'stormy'];
      setWeather(weathers[Math.floor(Math.random() * weathers.length)]);
    }

    // Sky Shooter Spawning Logic (Reduced frequency and count)
    if (frameCountRef.current - lastSkyShooterTimeRef.current >= 600 && score >= noSpawnScoreRef.current && !bossRef.current) {
      if (obstaclesRef.current.length < MAX_OBSTACLES) {
        for (let i = 0; i < 1; i++) {
          const y = GROUND_Y - 150 - Math.random() * 150;
          obstaclesRef.current.push({
            id: obstacleIdCounterRef.current++,
            x: CANVAS_WIDTH,
            y,
            width: 40,
            height: 40,
            type: 'shooter',
            category: 'enemy',
            vx: -speedRef.current * 0.8,
            shootTimer: 60 + Math.random() * 60
          });
        }
      }
      lastSkyShooterTimeRef.current = frameCountRef.current;
    }

    // Lava Eruption Logic (Every 37 seconds)
    if (currentWorld === 'LAVA' && gameState === 'PLAYING' && !bossRef.current) {
      const eruptionCycle = 37 * 60;
      const eruptionFrame = frameCountRef.current % eruptionCycle;
      if (eruptionFrame === 10) {
        createDamageText(CANVAS_WIDTH / 2, 100, 'VOLCANO ERUPTING!', '#ff4e00');
        playProceduralSound('boss', isMuted);
      }
      if (eruptionFrame >= 60 && eruptionFrame < 360 && frameCountRef.current % 12 === 0) {
        const isWave = Math.random() > 0.6;
        obstaclesRef.current.push({
          id: obstacleIdCounterRef.current++,
          x: CANVAS_WIDTH + 100,
          y: isWave ? GROUND_Y - 55 : -50,
          width: isWave ? 140 : 25,
          height: isWave ? 55 : 25,
          type: isWave ? 'lava_wave' : 'ember',
          category: 'static',
          vx: isWave ? -(speedRef.current + 8) : -(2 + Math.random() * 6),
          vy: isWave ? 0 : 4 + Math.random() * 6
        });
      }
    }

    // Horde: 5 per 1000 score (Reduced from 21)
    const currentThousandHorde = Math.floor(score / 1000);
    const lastThousandHorde = Math.floor(lastHordeScoreRef.current / 1000);
    if (currentThousandHorde > lastThousandHorde && score > 0 && !bossRef.current && score >= noSpawnScoreRef.current) {
      const hordeSize = Math.min(5, MAX_OBSTACLES - obstaclesRef.current.length);
      for (let i = 0; i < hordeSize; i++) {
        const y = GROUND_Y - 50 - Math.random() * 250;
        obstaclesRef.current.push({
          id: obstacleIdCounterRef.current++,
          x: CANVAS_WIDTH + i * 30,
          y,
          width: 40,
          height: 40,
          type: 'shooter',
          category: 'enemy',
          vx: -speedRef.current * 0.8,
          shootTimer: 60 + Math.random() * 120
        });
      }
      lastHordeScoreRef.current = score;
    }

    // Projectiles (Enemy bullets)
    projectilesRef.current.forEach((proj, index) => {

      // Update trail
      if (!proj.trail) proj.trail = [];
      proj.trail.push({ x: proj.x + proj.width/2, y: proj.y + proj.height/2 });
      if (proj.trail.length > 10) proj.trail.shift();

      // Boss projectiles home in on player
      const isBossProjectile = bossRef.current && proj.sourceId === bossRef.current.id;
      if (isBossProjectile && !proj.isHarmless) {
        // In Phase 3, all boss projectiles have some homing capability
        // Or if specifically marked as isHoming
        const isPhase3 = bossRef.current && bossRef.current.phase === 3;
        if (isPhase3 || proj.isHoming) {
          const dx = player.x + player.width / 2 - proj.x;
          const dy = player.y + player.height / 2 - proj.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 1) {
            const speed = Math.sqrt(proj.vx * proj.vx + proj.vy * proj.vy) || 7;
            const homingStrength = isPhase3 ? 0.05 : 0.1; // Phase 3 is slightly less aggressive homing to allow dodging
            proj.vx += (dx / dist * speed - proj.vx) * homingStrength;
            proj.vy += (dy / dist * speed - proj.vy) * homingStrength;
          }
        }
      }

      proj.x += proj.vx;
      proj.y += proj.vy;

      // Collision with player
      if (
        !player.isDiving &&
        !proj.isHarmless &&
        player.protectionTimer <= 0 &&
        player.x < proj.x + proj.width &&
        player.x + player.width > proj.x &&
        player.y < proj.y + proj.height &&
        player.y + player.height > proj.y
      ) {
        handlePlayerHit('#ff4e00', 15); // Projectiles deal less damage
        projectilesRef.current.splice(index, 1);
      }

      if (proj.x < -50 || proj.x > CANVAS_WIDTH + 50 || proj.y < -50 || proj.y > CANVAS_HEIGHT + 50) {
        projectilesRef.current.splice(index, 1);
      }
    });

    // Power-ups
    if (frameCountRef.current % (isDeepSleep ? 150 : 300) === 0) {
      spawnPowerUp();
    }

    powerUpsRef.current.forEach((p, index) => {
      p.x -= effectiveSpeed;

      // Panther Magnet Ability (Singularity Magnet)
      if (selectedCharacterId === 7 && !p.collected) {
        const dx = (player.x + player.width / 2) - (p.x + p.width / 2);
        const dy = (player.y + player.height / 2) - (p.y + p.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 300) {
          const force = (300 - dist) / 300 * 5;
          p.x += (dx / dist) * force;
          p.y += (dy / dist) * force;
        }
      }
      
      // Visibility-based Tutorial trigger
      if (score < 1500 && !seenObjectsRef.current.has(p.type) && p.x < CANVAS_WIDTH - 150) {
        checkTutorialTrigger(p.type, p.x, p.y);
      }
      if (
        !p.collected &&
        player.x < p.x + p.width &&
        player.x + player.width > p.x &&
        player.y < p.y + p.height &&
        player.y + player.height > p.y
      ) {
        p.collected = true;
        createCollectEffect(p.x + p.width/2, p.y + p.height/2, '#ffffff');
        
        if (p.type === 'star') {
          playProceduralSound('collect', isMuted);
          
          // Health Boost from Star
          const selectedChar = CHARACTERS.find(c => c.id === selectedCharacterId) || CHARACTERS[0];
          const maxH = 100 + (upgradeLevels.health || 0) * 20 + (selectedChar.extraStats?.maxHealth || 0);
          const healAmt = selectedCharacterId === 7 ? 50 : 25; // Panther heals more (Soul Siphon)
          setHealth(prev => Math.min(prev + healAmt, maxH));
          createDamageText(p.x, p.y - 40, `+${healAmt} HP`, '#22c55e');
          
          if (selectedCharacterId === 7) {
             setScore(s => s + 1000);
             createDamageText(p.x, p.y - 70, "STAR HARVEST +1000", "#fbbf24");
          }

          const worldQuestions = QUIZ_QUESTIONS[currentWorld] || QUIZ_QUESTIONS.MISSION;
          const usedIndices = usedQuizQuestions[currentWorld] || [];
          let availableIndices = worldQuestions.map((_, i) => i).filter(i => !usedIndices.includes(i));
          if (availableIndices.length === 0) {
            setUsedQuizQuestions(prev => ({ ...prev, [currentWorld]: [] }));
            availableIndices = worldQuestions.map((_, i) => i);
          }
          const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
          const randomQ = worldQuestions[randomIndex];
          setQuizState({ active: true, question: randomQ, index: randomIndex });
        } else if (p.type === 'shield') {
          playProceduralSound('powerup', isMuted);
          player.shieldStacks = (player.shieldStacks || 0) + 1;
          createDamageText(p.x, p.y - 20, `SHIELD x${player.shieldStacks}`, '#00ccff');
        } else if (p.type === 'feather') {
          playProceduralSound('collect', isMuted);
          player.featherCharges = 2; // Now allows Quadruple Jump (1 grounded + 3 air jumps)
          createDamageText(p.x, p.y - 20, 'FEATHER', '#ffffff');
        } else if (p.type === 'hourglass') {
          playProceduralSound('powerup', isMuted);
          player.hourglassTimer = 300; 
          createDamageText(p.x, p.y - 20, 'SLOW MOTION', '#67e8f9');
        } else if (p.type === 'double_jump') {
          playProceduralSound('powerup', isMuted);
          player.canDoubleJump = true; // Temporary flag for infinite double jump for a while?
          // Let's make it infinite air jumps for 10 seconds
          player.skillCooldown = 0; 
          createDamageText(p.x, p.y - 20, 'HYPER JUMP', '#fbbf24');
        }
        
        powerUpsRef.current.splice(index, 1);
        return;
      }

      if (p.x + p.width < 0) {
        powerUpsRef.current.splice(index, 1);
      }
    });

    // Obstacles
    const spawnRate = Math.floor(180 / (effectiveSpeed / 5));
    if (frameCountRef.current % Math.max(1, spawnRate) === 0 && !bossRef.current && player.score >= noSpawnScoreRef.current) {
      if (Math.random() > 0.5) spawnObstacle();
    }

    obstaclesRef.current.forEach((obs, index) => {
      // Basic movement
      obs.x -= effectiveSpeed;

      if (obs.type === 'falling_boulder') {
        obs.y += (obs.vy || 0);
        obs.x += (obs.vx || 0);
        if (obs.y + obs.height > GROUND_Y) {
          createParticles(obs.x + obs.width/2, GROUND_Y, '#5a4632', 'debris');
          playProceduralSound('impact', isMuted);
          obstaclesRef.current.splice(index, 1);
          return;
        }
      }

      // Visibility-based Tutorial trigger
      if (player.score < 1500 && !seenObjectsRef.current.has(obs.type) && obs.x < CANVAS_WIDTH - 150) {
        checkTutorialTrigger(obs.type, obs.x, obs.y);
      }
      if (obs.type === 'bat' || obs.type === 'ghost') {
        obs.x += (obs.vx || 0);
        
        // Behavior State Machine
        if (obs.behaviorPhase === 0) {
          // Phase 0: Approach / Dive
          const dy = (obs.targetY || 0) - obs.y;
          obs.y += dy * 0.05;
          if (Math.abs(dy) < 5) obs.behaviorPhase = 1;
        } else if (obs.behaviorPhase === 1) {
          // Phase 1: Linger / Patrol near ground
          obs.y += Math.sin(frameCountRef.current * 0.08) * 1.5;
          // Counteract movement speed a bit to "linger"
          obs.x += effectiveSpeed * 0.4; 
          
          if (obs.behaviorTimer !== undefined) {
            obs.behaviorTimer--;
            if (obs.behaviorTimer <= 0) obs.behaviorPhase = 2;
          }
        } else if (obs.behaviorPhase === 2) {
          // Phase 2: Exit / Fly Off
          obs.vy = (obs.vy || 0) - 0.2;
          obs.y += obs.vy;
          obs.x -= 2; // Extra speed to fly off
        }
      } else if (obs.type === 'yarn') {
        obs.x += (obs.vx || 0) * effectiveSpeed * 0.5;
      } else if (obs.type === 'shooter') {
        if (obs.shootTimer !== undefined) {
          obs.shootTimer--;
          if (obs.shootTimer <= 0) {
            if (projectilesRef.current.length < MAX_PROJECTILES) {
              const dx = player.x - obs.x;
              const dy = player.y - obs.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              projectilesRef.current.push({
                x: obs.x,
                y: obs.y + obs.height/2,
                width: 12,
                height: 12,
                vx: (dx / dist) * 7.5,
                vy: (dy / dist) * 7.5,
                sourceId: obs.id
              });
            }
            obs.shootTimer = 150 + Math.random() * 100;
          }
        }
      } else if (obs.type === 'crumbling') {
        if (player.x < obs.x + obs.width && player.x + player.width > obs.x && Math.abs(player.y + player.height - obs.y) < 30) {
           if (obs.crumbleTimer && obs.crumbleTimer > 0) {
             obs.crumbleTimer--;
             if (frameCountRef.current % 10 === 0) createParticles(obs.x + Math.random() * obs.width, obs.y, '#555', 'smoke');
           } else {
             obs.vy = (obs.vy || 0) + 0.4;
             obs.y += obs.vy;
           }
        } else if (obs.crumbleTimer && obs.crumbleTimer < 90) {
           obs.crumbleTimer--;
           if (obs.crumbleTimer <= 0) {
             obs.vy = (obs.vy || 0) + 0.4;
             obs.y += obs.vy;
           }
        }
      } else if (obs.type === 'conveyor') {
        if (player.x < obs.x + obs.width && player.x + player.width > obs.x && Math.abs(player.y + player.height - obs.y) < 30 && player.vy >= 0) {
           player.x += (obs.conveyorSpeed || 1);
           player.y = obs.y - player.height;
           player.vy = 0;
           player.isJumping = false;
        }
      } else if (obs.type === 'spring_trap') {
        if (player.x < obs.x + obs.width && player.x + player.width > obs.x && Math.abs(player.y + player.height - obs.y) < 20) {
           player.vy = -22;
           player.isJumping = true;
           playProceduralSound('jump', isMuted);
           createParticles(obs.x + obs.width/2, obs.y, '#00ffff', 'spark');
        }
      }

      // Collision Detection (Invincible during dive or protection)
      const isRagdoll = selectedCharacterId === 5;
      const isPanther = selectedCharacterId === 7;

      if (obs.type === 'cloud' && isRagdoll) {
        // Ragdoll Float Interaction
        if (
          player.x < obs.x + obs.width &&
          player.x + player.width > obs.x &&
          player.y < obs.y + obs.height &&
          player.y + player.height > obs.y - 100 // Area above cloud
        ) {
          player.vy *= 0.8; // Slow fall
          player.vy -= 0.6; // Slight lift
          createParticles(player.x + player.width/2, player.y + player.height, '#fff', 'spark');
        }
      }

      if (obs.type === 'fear_wall' && isPanther) {
        // Panther Break Fear Wall Interaction
        if (
          player.x < obs.x + obs.width + 20 &&
          player.x + player.width > obs.x - 20 &&
          player.y < obs.y + obs.height &&
          player.y + player.height > obs.y
        ) {
          createParticles(obs.x + obs.width/2, obs.y + obs.height/2, '#a855f7', 'debris');
          obstaclesRef.current.splice(index, 1);
          setScore(s => s + 250);
          createDamageText(obs.x, obs.y, 'SHATTERED!', '#a855f7');
          return;
        }
      }

      if (
        player.x < obs.x + obs.width &&
        player.x + player.width > obs.x &&
        player.y < obs.y + obs.height &&
        player.y + player.height > obs.y
      ) {
        if (
          !player.isDiving &&
          player.protectionTimer <= 0
        ) {
          if (obs.category === 'interactive') {
            // Semi-solid or special behavior for non-matching cats
            if (obs.type === 'fear_wall') {
              handlePlayerHit('#ff4e00', 30); // Very painful wall
              obstaclesRef.current.splice(index, 1);
            }
            // Clouds are harmless to others, just visual
          } else {
            handlePlayerHit('#ff4e00', 15); // Obstacles deal less damage
            obstaclesRef.current.splice(index, 1);
          }
        }
      }

      if (obs.x + obs.width < 0) {
        obstaclesRef.current.splice(index, 1);
      }
    });

    // Boss Logic
    if (bossRef.current) {
      const boss = bossRef.current;

      if (boss.isDying) {
        boss.deathTimer = (boss.deathTimer || 0) - 1;
        shakeOffsetRef.current = { x: (Math.random() - 0.5) * 50, y: (Math.random() - 0.5) * 50 };
        
        if (frameCountRef.current % 4 === 0) {
          const rx = boss.x + Math.random() * boss.width;
          const ry = boss.y + Math.random() * boss.height;
          createParticles(rx, ry, '#ffffff', 'fire');
          createParticles(rx, ry, '#ff4e00', 'spark');
          playProceduralSound('impact', isMuted);
        }

        if (boss.deathTimer <= 0) {
          flashAlphaRef.current = 1.0;
          
          // Defeat Rewards
          let coinBonus = currentWorld === 'MISSION' ? 5000 : (currentWorld === 'COSMIC' ? 15000 : 50000);
          
          if (currentWorld === 'LAVA') {
            coinBonus = 100000;
            const selectedChar = CHARACTERS.find(c => c.id === selectedCharacterId) || CHARACTERS[0];
            const maxH = 100 + (upgradeLevels.health || 0) * 20 + (selectedChar.extraStats?.maxHealth || 0);
            if (health >= maxH - 25) {
               coinBonus += 300000;
               createDamageText(player.x, player.y - 120, `EXPERT SLAYER BONUS! +300,000`, '#f59e0b');
               playProceduralSound('level_up', isMuted);
            }
          }

          setTotalCoins(prev => prev + coinBonus);
          createDamageText(player.x, player.y - 60, `BOSS DEFEATED! +${coinBonus} SOUL COINS`, '#fbbf24');
          
          // Special Unlocks
          if (currentWorld === 'MISSION' && !unlockedCharacters.includes(2)) {
            setUnlockedCharacters(prev => [...prev, 2]);
            createDamageText(player.x, player.y - 90, 'UNLOCKED: MIDNIGHT VOID FORM!', '#a855f7');
          } else if (currentWorld === 'COSMIC' && !unlockedCharacters.includes(3)) {
            setUnlockedCharacters(prev => [...prev, 3]);
            createDamageText(player.x, player.y - 90, 'UNLOCKED: GOLDEN CALICO FORM!', '#fbbf24');
          }

          if (currentWorld === 'MISSION') setCurrentWorld('COSMIC');
          else if (currentWorld === 'COSMIC') setCurrentWorld('LAVA');
          else if (currentWorld === 'LAVA') setCurrentWorld('AQUATIC');
          else setGameState('WIN');

          playProceduralSound('level_up', isMuted);
          bossRef.current = null;
          obstaclesRef.current = [];
          powerUpsRef.current = [];
          lastBossScoreRef.current = score;
          noSpawnScoreRef.current = score + 2000;
        }
        return;
      }

      const healthPercent = (boss.health / boss.maxHealth) * 100;
      
      // Phase Transitions
      let currentPhase = 1;
      if (healthPercent <= 30) currentPhase = 3;
      else if (healthPercent <= 70) currentPhase = 2;
      
      if (boss.phase !== currentPhase) {
        boss.phase = currentPhase;
        // Visual feedback for phase change
        shakeOffsetRef.current = { x: (Math.random() - 0.5) * 40, y: (Math.random() - 0.5) * 40 };
        createParticles(boss.x + boss.width/2, boss.y + boss.height/2, '#ffffff');
        for(let i=0; i<10; i++) createParticles(boss.x + Math.random()*boss.width, boss.y + Math.random()*boss.height, '#ffcc00');
      }

      // Movement
      if (boss.x > CANVAS_WIDTH - 250) {
        boss.x -= 2;
      } else {
        // Movement State Machine
        if (boss.movementTimer > 0) boss.movementTimer--;
        if (boss.movementTimer <= 0) {
          if (boss.movementState === 'IDLE') {
            boss.movementState = Math.random() > 0.5 ? 'CHARGE' : 'LEAP';
            boss.movementTimer = boss.movementState === 'CHARGE' ? 120 : 180;
            boss.targetX = player.x; boss.targetY = player.y - boss.height / 2;
          } else {
            boss.movementState = 'IDLE'; boss.movementTimer = 180;
          }
        }

        if (boss.movementState === 'IDLE') {
          boss.y += Math.sin(frameCountRef.current * 0.05) * 1.5;
          boss.x += Math.cos(frameCountRef.current * 0.03) * 1;
        } else if (boss.movementState === 'CHARGE') {
          const speed = boss.phase === 3 ? 0.07 : (boss.phase === 2 ? 0.04 : 0.02);
          if (boss.targetX !== undefined && boss.targetY !== undefined) {
            boss.x += (boss.targetX - boss.x) * speed;
            boss.y += (boss.targetY - boss.y) * speed;
          }
        } else if (boss.movementState === 'LEAP') {
          if (frameCountRef.current % 40 === 0) {
            boss.targetX = Math.random() * (CANVAS_WIDTH - 350) + 100;
            boss.targetY = Math.random() * (GROUND_Y - 300) + 50;
          }
          if (boss.targetX !== undefined && boss.targetY !== undefined) {
            boss.x += (boss.targetX - boss.x) * 0.08;
            boss.y += (boss.targetY - boss.y) * 0.08;
          }
        }
        
        // Attack
        if (score >= noSpawnScoreRef.current) {
          boss.attackTimer--;
          if (boss.attackTimer <= 0) {
          const dx = player.x - boss.x;
          const dy = player.y - boss.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (boss.type === 'DREAM_EATER') {
            if (boss.phase === 1) {
              // Standard spread
              for (let i = -1; i <= 1; i++) {
                projectilesRef.current.push({
                  x: boss.x,
                  y: boss.y + boss.height / 2,
                  width: 20,
                  height: 20,
                  vx: (dx / dist) * 6,
                  vy: (dy / dist) * 6 + i * 1.5,
                  sourceId: boss.id,
                  projType: 'fireball'
                });
              }
            } else if (boss.phase === 2) {
              // Wider spread + faster
              for (let i = -2; i <= 2; i++) {
                projectilesRef.current.push({
                  x: boss.x,
                  y: boss.y + boss.height / 2,
                  width: 22,
                  height: 22,
                  vx: (dx / dist) * 8,
                  vy: (dy / dist) * 8 + i * 2,
                  sourceId: boss.id,
                  projType: 'fireball'
                });
              }
            } else {
              // Phase 3: Massive spread + homing projectiles
              for (let i = -3; i <= 3; i++) {
                projectilesRef.current.push({
                  x: boss.x,
                  y: boss.y + boss.height / 2,
                  width: 25,
                  height: 25,
                  vx: (dx / dist) * 7,
                  vy: (dy / dist) * 7 + i * 2.5,
                  sourceId: boss.id,
                  projType: 'fireball'
                });
              }
            }
          } else if (boss.type === 'COSMIC_VOID') {
            if (boss.phase === 1) {
              projectilesRef.current.push({
                x: boss.x,
                y: boss.y + boss.height / 2,
                width: 25,
                height: 25,
                vx: (dx / dist) * 9,
                vy: (dy / dist) * 9,
                sourceId: boss.id,
                projType: 'spike'
              });
            } else if (boss.phase === 2) {
              for (let i = 0; i < 2; i++) {
                projectilesRef.current.push({
                  x: boss.x,
                  y: boss.y + boss.height / 2 + (i * 40 - 20),
                  width: 28,
                  height: 28,
                  vx: (dx / dist) * 10,
                  vy: (dy / dist) * 10,
                  sourceId: boss.id,
                  projType: 'spike'
                });
              }
            } else {
              for (let i = 0; i < 3; i++) {
                setTimeout(() => {
                  if (!bossRef.current) return;
                  projectilesRef.current.push({
                    x: boss.x,
                    y: boss.y + boss.height / 2,
                    width: 30,
                    height: 30,
                    vx: (dx / dist) * 12,
                    vy: (dy / dist) * 12,
                    sourceId: boss.id,
                    projType: 'spike'
                  });
                }, i * 100);
              }
            }
          } else if (boss.type === 'LAVA_DINO') {
            // Rapid fire fireballs
                      const count = boss.phase === 3 ? 3 : (boss.phase === 2 ? 2 : 1);
          if (frameCountRef.current % 120 === 0) {
            createDamageText(boss.x + boss.width / 2, boss.y - 100, 'ROAR!', '#ff4e00');
          }
          for (let i = 0; i < count; i++) {
            projectilesRef.current.push({
              x: boss.x + boss.width / 3,
              y: boss.y + 10,
              width: 30,
              height: 30,
              vx: (dx / dist) * 12,
              vy: (dy / dist) * 12 + (Math.random() - 0.5) * 4,
              sourceId: boss.id,
              projType: 'fireball'
            });
          }
        } // This closes your 'if (boss.type === 'BOSS')' or similar loop
      } // This closes your next logic layer
    } // This closes your next logic layer
  } // This closes your next logic layer
                

          
    frameCountRef.current++;
}, [
  gameState,
  spawnObstacle,
  spawnBoss,
  createParticles,
  createAmbientParticles,
  createCollectEffect,
  handlePlayerHit,
  quizState,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GROUND_Y,
  selectedCharacterId,
  upgradeLevels,
  isMuted
]);

    
          
          // Attack cooldown decreases with phase
          const baseCooldown = boss.phase === 1 ? 120 : (boss.phase === 2 ? 80 : 50);
          boss.attackTimer = baseCooldown - (100 - healthPercent) * 0.2;
        }
      }
    }

      // Collision with player
      if (
        player.protectionTimer <= 0 &&
        player.x < boss.x + boss.width &&
        player.x + player.width > boss.x &&
        player.y < boss.y + boss.height &&
        player.y + player.height > boss.y
      ) {
        handlePlayerHit('#ff0000', 30);
      }
    }

    // Particles
    particlesRef.current.forEach((p, index) => {
      p.x += p.vx;
      p.y += p.vy;
      
      if (p.type === 'smoke') {
        p.life -= 0.002; // Even slower fade
        p.width += 0.3; // More expansion
        p.height += 0.3;
      } else if (p.type === 'fire') {
        p.life -= 0.005; // Slower fade
        p.vy = -Math.random() * 3; // Faster flicker
        p.vx = (Math.random() - 0.5) * 3;
      } else {
        p.life -= 0.02;
      }

      if (p.life <= 0) particlesRef.current.splice(index, 1);
    });

    // Collect Effects
    collectEffectsRef.current.forEach((eff, index) => {
      eff.radius += (eff.maxRadius - eff.radius) * 0.1;
      eff.life -= 0.02;
      if (eff.life <= 0) {
        collectEffectsRef.current.splice(index, 1);
      }
    });

    // Update Flash
    if (flashAlphaRef.current > 0) {
      flashAlphaRef.current -= 0.04;
    }

    // Ambient particles
    if (frameCountRef.current % 10 === 0) {
      createAmbientParticles();
    }

    // Damage texts
    damageTextsRef.current.forEach((dt, index) => {
      dt.y += dt.vy;
      dt.life -= 0.02;
      if (dt.life <= 0) {
        damageTextsRef.current.splice(index, 1);
      }
    });

    // Update Slashes
    for (let i = slashesRef.current.length - 1; i >= 0; i--) {
      const s = slashesRef.current[i];
      s.life -= 0.04;
      if (s.life <= 0) slashesRef.current.splice(i, 1);
    }

    // Fade damage flash
    if (player.damageFlashAlpha > 0) {
          player.damageFlashAlpha = Math.max(0, player.damageFlashAlpha - 0.05);
  } // Closes 'if (player.damageFlashAlpha > 0)'
} // Closes the 'if' or 'for' loop above that
} // Closes the next outer logic layer
} // Closes the next outer logic layer
} // Closes the final outer logic layer

  frameCountRef.current++;
}, [
  gameState,
  spawnObstacle,
  spawnBoss,
  createParticles,
  createAmbientParticles,
  createCollectEffect,
  handlePlayerHit,
  quizState,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GROUND_Y,
  selectedCharacterId,
  upgradeLevels,
  isMuted
]);
  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Camera Transform (Zoom)
    const player = playerRef.current;
    // Shadow reactive state with ref-based mirrors for performance stability
    const currentWorld = player.currentWorld;
    const gameState = player.gameState;
    const isDeepSleep = player.isDeepSleep;
    const weather = player.weather;
    const cameraZoom = player.cameraZoom;
    const score = player.score;
    const combo = player.combo;
    const health = player.health;
    const worldFlow = player.worldFlow;

    ctx.save();
    const zoomPivotX = player.x + player.width/2;
    const zoomPivotY = player.y + player.height/2;
    ctx.translate(zoomPivotX, zoomPivotY);
    ctx.scale(player.cameraZoom, player.cameraZoom);
    ctx.translate(-zoomPivotX, -zoomPivotY);

    // Combined Screen Shake
    ctx.save();
    ctx.translate(shakeOffsetRef.current.x + shake.x, shakeOffsetRef.current.y + shake.y);

    // Weather Visuals Back layer
    if (player.weather === 'rainy' || player.weather === 'stormy' || player.weather === 'snow' || player.weather === 'ash' || player.weather === 'starlight') {
      const isSnow = player.weather === 'snow' || player.weather === 'ash';
      const isStarlight = player.weather === 'starlight';
      ctx.strokeStyle = player.weather === 'stormy' ? 'rgba(150, 150, 255, 0.4)' : (isStarlight ? 'rgba(255, 255, 0, 0.6)' : 'rgba(255, 255, 255, 0.15)');
      if (player.weather === 'ash') ctx.strokeStyle = 'rgba(255, 100, 0, 0.3)';
      
      ctx.lineWidth = isSnow ? 2 : 1;
      const count = player.weather === 'stormy' ? 60 : 30;
      for (let i = 0; i < count; i++) {
        const rx = (i * 73 + frameCountRef.current * (isSnow ? 2 : 12)) % CANVAS_WIDTH;
        const ry = (i * 31 + frameCountRef.current * (isSnow ? 3 : 18)) % CANVAS_HEIGHT;
        ctx.beginPath(); 
        if (isSnow) {
          ctx.arc(rx, ry, 1.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (isStarlight) {
          ctx.moveTo(rx, ry); ctx.lineTo(rx - 8, ry + 2); ctx.stroke();
        } else {
          ctx.moveTo(rx, ry); ctx.lineTo(rx - 4, ry + 12); ctx.stroke();
        }
      }
    }

    // Parallax Layer 0: Stars / Voids (Slowest)
    const p0X = -(frameCountRef.current * 0.1) % CANVAS_WIDTH;
    const pLayerColor = player.currentWorld === 'MISSION' ? 'rgba(255,255,255,0.2)' : 'rgba(0,255,255,0.3)';
    for(let i=0; i<2; i++) {
      ctx.save();
      ctx.translate(p0X + i * CANVAS_WIDTH, 0);
      for(let j=0; j<20; j++) {
        const x = (j * 113) % CANVAS_WIDTH;
        const y = (j * 67) % (GROUND_Y - 150);
        ctx.fillStyle = pLayerColor;
        ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // --- Dynamic Dreamy Background (Parallax Layer 1) ---
    const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    if (player.currentWorld === 'MISSION') {
      if (player.isDeepSleep) {
        skyGrad.addColorStop(0, '#020002');
        skyGrad.addColorStop(1, '#1e1b4b');
      } else {
        skyGrad.addColorStop(0, '#050208');
        skyGrad.addColorStop(1, '#0c051a');
      }
    } else if (player.currentWorld === 'COSMIC') {
      if (player.isDeepSleep) {
        skyGrad.addColorStop(0, '#000000');
        skyGrad.addColorStop(1, '#2e1065');
      } else {
        skyGrad.addColorStop(0, '#020205'); // Deep Space
        skyGrad.addColorStop(1, '#0a0a20');
      }
    } else {
      // Lava World
      skyGrad.addColorStop(0, '#1a0505');
      skyGrad.addColorStop(1, '#000000');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // --- World Elements ---
    if (player.currentWorld === 'MISSION') {
      // Background City Silhouettes (Parallax)
      ctx.save();
      const cityX = (-frameCountRef.current * 0.3) % (CANVAS_WIDTH * 2);
      ctx.fillStyle = '#020617';
      for (let i = 0; i < 15; i++) {
        const bx = (cityX + i * 180) % (CANVAS_WIDTH + 200) - 100;
        const bw = 60 + Math.sin(i) * 30;
        const bh = 150 + Math.cos(i * 1.3) * 80;
        ctx.fillRect(bx, GROUND_Y - bh, bw, bh);
        // Window lights in buildings
        ctx.fillStyle = i % 3 === 0 ? '#fbbf24' : '#1e293b';
        ctx.globalAlpha = 0.6;
        for (let r = 1; r < 5; r++) {
          for (let c = 0; c < 2; c++) {
            if ((i + r + c) % 4 === 0) {
              ctx.fillRect(bx + 10 + c * 25, GROUND_Y - bh + r * 30, 10, 15);
            }
          }
        }
        ctx.fillStyle = '#020617';
        ctx.globalAlpha = 1.0;
      }
      ctx.restore();

      // Atmospheric: Dust Motes
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      for (let i = 0; i < 15; i++) {
        const mx = (i * 157 + frameCountRef.current * 0.5) % CANVAS_WIDTH;
        const my = (i * 97 + Math.sin(frameCountRef.current * 0.02 + i) * 30) % GROUND_Y;
        ctx.beginPath();
        ctx.arc(mx, my, 1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Window with Moon view
      ctx.save();
      const windowX = 100;
      const windowY = 50;
      const windowW = 120;
      const windowH = 150;
      
      // Window Frame Glow
      ctx.shadowBlur = 20;
      ctx.shadowColor = 'rgba(100, 150, 255, 0.3)';
      ctx.fillStyle = '#0a0a20';
      ctx.fillRect(windowX, windowY, windowW, windowH);
      
      // Window Panes
      ctx.strokeStyle = '#1e1b4b';
      ctx.lineWidth = 4;
      ctx.strokeRect(windowX, windowY, windowW, windowH);
      ctx.beginPath();
      ctx.moveTo(windowX + windowW/2, windowY); ctx.lineTo(windowX + windowW/2, windowY + windowH);
      ctx.moveTo(windowX, windowY + windowH/2); ctx.lineTo(windowX + windowW, windowY + windowH/2);
      ctx.stroke();

      // The Moon
      ctx.fillStyle = '#e2e8f0';
      ctx.shadowBlur = 30;
      ctx.shadowColor = '#fff';
      ctx.beginPath();
      ctx.arc(windowX + 40, windowY + 40, 15, 0, Math.PI * 2);
      ctx.fill();
      // Moon Shadow for crescent
      ctx.fillStyle = '#0a0a20';
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(windowX + 48, windowY + 40, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Distant Bedroom Silhouettes (Furniture)
      ctx.fillStyle = '#050208';
      // Bed silhouette
      ctx.beginPath();
      ctx.roundRect(400, GROUND_Y - 60, 250, 60, [20, 20, 0, 0]);
      ctx.fill();
      // Pillow silhouette
      ctx.beginPath();
      ctx.roundRect(410, GROUND_Y - 80, 60, 30, 10);
      ctx.fill();
      // Lamp silhouette
      ctx.fillRect(700, GROUND_Y - 120, 10, 120);
      ctx.beginPath();
      ctx.moveTo(680, GROUND_Y - 120);
      ctx.lineTo(730, GROUND_Y - 120);
      ctx.lineTo(715, GROUND_Y - 150);
      ctx.lineTo(695, GROUND_Y - 150);
      ctx.closePath();
      ctx.fill();
    } else if (player.currentWorld === 'AQUATIC') {
      // Deep Sea / Aquatic World
      ctx.save();
      const oceanGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      oceanGrad.addColorStop(0, '#0c4a6e');
      oceanGrad.addColorStop(0.5, '#075985');
      oceanGrad.addColorStop(1, '#020617');
      ctx.fillStyle = oceanGrad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Sea Plants (Coral/Kelp) - Swaying and Colorful
      ctx.globalAlpha = 0.8;
      for(let i=0; i<20; i++) {
          const px = (i * 120 + frameCountRef.current * 0.4) % (CANVAS_WIDTH + 200) - 100;
          const h = 80 + Math.sin(i * 1.5) * 30;
          const grad = ctx.createLinearGradient(px, GROUND_Y, px, GROUND_Y - h);
          grad.addColorStop(0, i % 2 === 0 ? '#991b1b' : '#065f46'); // More colors for flora
          grad.addColorStop(1, i % 2 === 0 ? '#f43f5e' : '#34d399');
          ctx.strokeStyle = grad;
          ctx.lineWidth = i % 3 === 0 ? 10 : 6;
          ctx.beginPath();
          ctx.moveTo(px, GROUND_Y);
          for(let j=0; j<6; j++) {
              const sway = Math.sin(frameCountRef.current * 0.04 + j + i) * (j * 4);
              ctx.lineTo(px + sway, GROUND_Y - j * (h/5));
          }
          ctx.stroke();
          
          // Anemones / Small coral at base
          ctx.fillStyle = i % 4 === 0 ? '#fb7185' : '#818cf8';
          ctx.beginPath();
          ctx.arc(px, GROUND_Y, 15, Math.PI, 0);
          ctx.fill();
          
          // Bubbles from plants
          if (frameCountRef.current % 60 === i * 3 % 60) {
            ctx.fillStyle = '#fff';
            ctx.globalAlpha = 0.3;
            ctx.beginPath(); ctx.arc(px + Math.sin(frameCountRef.current*0.04)*20, GROUND_Y - h, 2, 0, Math.PI*2); ctx.fill();
            ctx.globalAlpha = 0.8;
          }
      }

      // Elegant Fishes
      for(let i=0; i<12; i++) {
          const fx = (i * 200 + frameCountRef.current * (1 + (i % 3))) % (CANVAS_WIDTH + 400) - 200;
          const fy = (i * 77 + 50) % (GROUND_Y - 80);
          const color = ['#38bdf8', '#f472b6', '#fbbf24', '#a78bfa'][i % 4];
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.ellipse(fx, fy, 12, 6, 0, 0, Math.PI * 2);
          ctx.fill();
          // Tail fin
          ctx.beginPath();
          ctx.moveTo(fx - 10, fy);
          ctx.lineTo(fx - 18, fy - 8);
          ctx.lineTo(fx - 18, fy + 8);
          ctx.fill();
          // Eye
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(fx + 6, fy - 2, 2, 0, Math.PI * 2); ctx.fill();
      }

      // Water Current Indicating Lines (Ethereal and Flowing)
      if (player.worldFlow.dir) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.lineWidth = 1;
          for(let i=0; i<40; i++) {
              const speed = (player.worldFlow.dir === 'right' ? 14 : (player.worldFlow.dir === 'left' ? -14 : 3));
              const cx = (i * 157 + frameCountRef.current * speed) % CANVAS_WIDTH;
              const vSpeed = (player.worldFlow.dir === 'down' ? 14 : (player.worldFlow.dir === 'up' ? -14 : 0));
              const cy = (i * 63 + frameCountRef.current * vSpeed) % (GROUND_Y);
              
              ctx.beginPath();
              if (player.worldFlow.dir === 'left' || player.worldFlow.dir === 'right') {
                ctx.moveTo(cx, cy); ctx.lineTo(cx + 80, cy);
                // Mini flow patterns
                ctx.moveTo(cx + 10, cy + 5); ctx.lineTo(cx + 40, cy + 5);
                ctx.moveTo(cx + 20, cy - 5); ctx.lineTo(cx + 50, cy - 5);
              } else {
                ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + 80);
              }
              ctx.stroke();
          }
      }

      // Bubbles Background
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#fff';
      for(let i=0; i<30; i++) {
        const bx = (Math.sin(frameCountRef.current * 0.01 + i) * 100 + i * 50) % CANVAS_WIDTH;
        const by = (frameCountRef.current * (1 + (i % 3)) + i * 40) % CANVAS_HEIGHT;
        ctx.beginPath();
        ctx.arc(bx, CANVAS_HEIGHT - (by % CANVAS_HEIGHT), 2 + (i % 5), 0, Math.PI * 2);
        ctx.fill();
      }

      // Atmospheric: Light Shafts (God Rays)
      ctx.save();
      ctx.globalAlpha = 0.1;
      for (let i = 0; i < 3; i++) {
        const sx = (i * 400 + Math.sin(frameCountRef.current * 0.01 + i) * 60) % CANVAS_WIDTH;
        const sGrad = ctx.createLinearGradient(sx, 0, sx - 100, 400);
        sGrad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        sGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = sGrad;
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx + 100, 0);
        ctx.lineTo(sx - 50, 500);
        ctx.lineTo(sx - 150, 500);
        ctx.fill();
      }
      ctx.restore();

      ctx.restore();
    } else if (player.currentWorld === 'COSMIC') {
      // COSMIC / Moon World
      // Nebulae Background
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const nx = (frameCountRef.current * 0.1 + i * 400) % (CANVAS_WIDTH + 800) - 400;
        const ny = 100 + Math.sin(i) * 100;
        const nGrad = ctx.createRadialGradient(nx, ny, 0, nx, ny, 300);
        const col = i % 2 === 0 ? 'rgba(168, 85, 247, 0.1)' : 'rgba(59, 130, 246, 0.1)';
        nGrad.addColorStop(0, col);
        nGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = nGrad;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
      ctx.restore();

      // Distant Planets
      ctx.save();
      for (let i = 0; i < 2; i++) {
        const px = (i * 800 + frameCountRef.current * 0.05) % (CANVAS_WIDTH + 400) - 200;
        const py = 50 + i * 150;
        const pr = 40 + i * 20;
        const pGrad = ctx.createRadialGradient(px - pr/3, py - pr/3, 0, px, py, pr);
        pGrad.addColorStop(0, i === 0 ? '#f87171' : '#4ade80');
        pGrad.addColorStop(1, i === 0 ? '#7f1d1d' : '#064e3b');
        ctx.fillStyle = pGrad;
        ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
        // Rings for one planet
        if (i === 1) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.ellipse(px, py, pr * 2.2, pr * 0.4, 0.3, 0, Math.PI * 2);
            ctx.stroke();
        }
      }
      ctx.restore();

      // Distant Earth
      ctx.save();
      const earthX = CANVAS_WIDTH * 0.7;
      const earthY = 120;
      const earthR = 100;
      
      const earthGrad = ctx.createRadialGradient(earthX - 20, earthY - 20, 0, earthX, earthY, earthR);
      earthGrad.addColorStop(0, '#60a5fa');
      earthGrad.addColorStop(0.7, '#1e40af');
      earthGrad.addColorStop(1, '#020617');
      
      ctx.shadowBlur = 50;
      ctx.shadowColor = '#3b82f6';
      ctx.fillStyle = earthGrad;
      ctx.beginPath();
      ctx.arc(earthX, earthY, earthR, 0, Math.PI * 2);
      ctx.fill();
      
      // Earth Swirls (Atmosphere)
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(earthX - 25, earthY + 10, 35, 8, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(earthX + 35, earthY - 20, 25, 5, -0.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // Moon Surface Silhouettes (Craters/Peaks)
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y);
      for (let i = 0; i <= 15; i++) {
        const x = (CANVAS_WIDTH / 15) * i;
        const y = GROUND_Y - 40 - Math.abs(Math.sin(i * 1.8 + frameCountRef.current * 0.001)) * 60;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
      ctx.fill();
      
      // Some craters on the horizon
      ctx.fillStyle = '#1e293b';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.ellipse(i * 400 + 150, GROUND_Y - 25, 80, 20, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else {
      // LAVA World Landscape (Detailed Volcanoes)
      ctx.save();
      const volcanoCount = 3;
      for (let i = 0; i < volcanoCount; i++) {
        const vx = ((i * 450 + frameCountRef.current * 0.2) % (CANVAS_WIDTH + 600)) - 300;
        const vh = 240 + Math.sin(i * 2.1) * 70;
        
        // Volcano Body with craggy texture
        ctx.save();
        const vGrad = ctx.createLinearGradient(vx - 200, 0, vx + 200, 0);
        vGrad.addColorStop(0, '#120202');
        vGrad.addColorStop(0.5, '#2a0a0a');
        vGrad.addColorStop(1, '#0a0101');
        ctx.fillStyle = vGrad;
        
        ctx.beginPath();
        ctx.moveTo(vx - 220, GROUND_Y);
        // Craggy edges
        for(let j=0; j<=10; j++) {
            const tx = vx - 220 + (j/10) * 220;
            const ty = GROUND_Y - (j/10) * vh + (Math.random() - 0.5) * 15;
            ctx.lineTo(tx, ty);
        }
        for(let j=1; j<=10; j++) {
            const tx = vx + (j/10) * 220;
            const ty = (GROUND_Y - vh) + (j/10) * vh + (Math.random() - 0.5) * 15;
            ctx.lineTo(tx, ty);
        }
        ctx.lineTo(vx + 220, GROUND_Y);
        ctx.fill();
        
        // Lava veins on side
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = '#ff4e00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(vx, GROUND_Y - vh + 20);
        ctx.lineTo(vx - 40, GROUND_Y - vh + 100);
        ctx.lineTo(vx - 20, GROUND_Y - 50);
        ctx.stroke();
        ctx.restore();
        
        // Magma Rim
        const eruptionCycle = 37 * 60;
        const eruptionFrame = frameCountRef.current % eruptionCycle;
        const isErupting = eruptionFrame >= 60 && eruptionFrame < 320;
        
        // Crater glow
        const craterGrad = ctx.createRadialGradient(vx, GROUND_Y - vh, 0, vx, GROUND_Y - vh, 60);
        craterGrad.addColorStop(0, isErupting ? '#fff' : '#ff4e00');
        craterGrad.addColorStop(0.4, '#ff4e00');
        craterGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = craterGrad;
        ctx.beginPath();
        ctx.ellipse(vx, GROUND_Y - vh, 60, 20, 0, 0, Math.PI * 2);
        ctx.fill();
        
        if (isErupting) {
            ctx.save();
            ctx.shadowBlur = 50;
            ctx.shadowColor = '#ff4e00';
            
            // Central fountain
            const fountainH = 40 + Math.random() * 30;
            ctx.fillStyle = '#ffcc00';
            ctx.beginPath();
            ctx.moveTo(vx - 20, GROUND_Y - vh);
            ctx.quadraticCurveTo(vx, GROUND_Y - vh - fountainH * 1.5, vx + 20, GROUND_Y - vh);
            ctx.fill();
            
            // Embers and smoke
            if (frameCountRef.current % 8 === 0) {
                createParticles(vx, GROUND_Y - vh - 20, '#ff4e00', 'fire');
                createParticles(vx + (Math.random()-0.5)*40, GROUND_Y-vh-40, '#333', 'spark');
            }
            ctx.restore();
        }
      }

      // Lava Flows on Ground
      for (let i = 0; i < 5; i++) {
        const lx = (i * 300 - frameCountRef.current * 1.5) % (CANVAS_WIDTH + 400) + 100;
        const lGrad = ctx.createLinearGradient(lx, GROUND_Y, lx + 200, GROUND_Y);
        lGrad.addColorStop(0, 'transparent');
        lGrad.addColorStop(0.5, '#f97316');
        lGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = lGrad;
        ctx.globalAlpha = 0.4 + Math.sin(frameCountRef.current * 0.1 + i) * 0.2;
        ctx.fillRect(lx, GROUND_Y - 5, 200, 10);
        ctx.globalAlpha = 1.0;
      }
      ctx.restore();

      // Atmospheric: Heat Distortion Shimmer
      ctx.save();
      ctx.globalAlpha = 0.15;
      for (let i = 0; i < 5; i++) {
        const hy = GROUND_Y - 100 - i * 40;
        const drift = Math.sin(frameCountRef.current * 0.05 + i) * 20;
        ctx.strokeStyle = i % 2 === 0 ? '#ff4e00' : '#ea580c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x < CANVAS_WIDTH; x += 40) {
          ctx.lineTo(x + drift, hy + Math.sin(x * 0.01 + frameCountRef.current * 0.1) * 5);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    // --- Atmospheric Aura / Aurora Layers ---
    ctx.save();
    for (let i = 0; i < 2; i++) {
        const time = frameCountRef.current * (0.003 + i * 0.001);
        ctx.globalAlpha = 0.08;
        const auroraGrad = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, 0);
        auroraGrad.addColorStop(0, 'transparent');
        auroraGrad.addColorStop(0.3, i === 0 ? '#ff00ff' : '#00ffff');
        auroraGrad.addColorStop(0.7, i === 0 ? '#00ffff' : '#ff00ff');
        auroraGrad.addColorStop(1, 'transparent');
        
        ctx.fillStyle = auroraGrad;
        const wave = Math.sin(time) * 40;
        ctx.beginPath();
        ctx.moveTo(0, 120 + wave);
        for(let x=0; x<CANVAS_WIDTH; x+=30) {
            ctx.lineTo(x, 120 + wave + Math.sin(x*0.01 + time)*40);
        }
        ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.lineTo(0, CANVAS_HEIGHT);
        ctx.fill();
    }
    ctx.restore();

    // Twinkling Stars
    for (let i = 0; i < 60; i++) {
      const x = (i * 137 + frameCountRef.current * 0.1) % CANVAS_WIDTH;
      const y = (i * 91) % (GROUND_Y - 50);
      const twinkle = Math.sin(frameCountRef.current * 0.03 + i) * 0.5 + 0.5;
      const size = i % 5 === 0 ? 2 : (i % 3 === 0 ? 1.5 : 0.8);
      ctx.fillStyle = `rgba(255, 255, 255, ${twinkle * 0.6})`;
      // Add a small glow to larger stars
      if (size > 1.5) {
        ctx.shadowBlur = 10 * twinkle;
        ctx.shadowColor = '#fff';
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Portal Rendering
    if (portalRef.current.active) {
      const p = portalRef.current;
      ctx.save();
      ctx.translate(p.x + 30, GROUND_Y - 100);
      const rotation = frameCountRef.current * 0.1;
      ctx.rotate(rotation);
      
      // Outer ring
      ctx.beginPath();
      ctx.ellipse(0, 0, 40, 80, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 5;
      ctx.stroke();
      
      // Inner swirl
      ctx.beginPath();
      ctx.ellipse(0, 0, 30, 60, rotation * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
      ctx.fill();
      
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#00ffff';
      ctx.stroke();
      ctx.restore();
    }
    
    // Animation state
    const isMoving = player.gameState === 'PLAYING';
    const runCycle = isMoving ? frameCountRef.current * 0.2 : 0;
    
    // Squash and stretch based on state and run cycle
    let squash = 1;
    let stretch = 1;
    let bounce = 0;
    
    if (player.isDiving && !player.hasImpacted) {
      stretch = 0.8;
      squash = 1.2;
    } else if (player.hasImpacted) {
      // Cat looks normal during dive impact
      stretch = 1;
      squash = 1;
    } else if (player.isJumping) {
      stretch = 1.1;
      squash = 0.9;
    } else if (isMoving) {
      bounce = Math.sin(runCycle) * 2;
      squash = 1 + Math.sin(runCycle) * 0.05;
      stretch = 1 - Math.sin(runCycle) * 0.05;
    }

    // --- Player Rendering ---
    const selectedChar = CHARACTERS.find(c => c.id === selectedCharacterId) || CHARACTERS[0];
    
    // Ghost Trails
    player.ghostTrail.forEach(trail => {
      ctx.save();
      ctx.translate(trail.x, trail.y);
      ctx.globalAlpha = trail.alpha;
      renderAnimalInstance(ctx, selectedChar, player.width, player.height, frameCountRef.current, {
        isMoving,
        isJumping: player.isJumping,
        isDiving: player.isDiving,
        rotation: player.rotation,
        bounce, stretch, squash,
        protection: false,
        shieldStacks: 0
      });
      ctx.restore();
    });

    ctx.save();
    ctx.translate(player.x, player.y);
    
    // Void Singularity Visual Effect
    if (selectedCharacterId === 7 && player.skillActive > 0) {
      ctx.save();
      ctx.translate(player.width/2, player.height/2);
      const pulse = 1 + Math.sin(frameCountRef.current * 0.2) * 0.1;
      const coreSize = 60 * pulse;
      
      // Core Singularity
      const singGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, coreSize);
      singGrad.addColorStop(0, '#000');
      singGrad.addColorStop(0.7, '#4c1d95');
      singGrad.addColorStop(1, 'transparent');
      
      ctx.fillStyle = singGrad;
      ctx.beginPath();
      ctx.arc(0, 0, coreSize, 0, Math.PI * 2);
      ctx.fill();
      
      // Swirling Orbits
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2;
      for(let i=0; i<3; i++) {
        ctx.save();
        ctx.rotate(frameCountRef.current * 0.05 + i * Math.PI / 1.5);
        ctx.beginPath();
        ctx.ellipse(0, 0, coreSize * 1.5, coreSize * 0.4, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    renderAnimalInstance(ctx, selectedChar, player.width, player.height, frameCountRef.current, {
      isMoving,
      isJumping: player.isJumping,
      isDiving: player.isDiving,
      rotation: player.rotation,
      bounce,
      stretch,
      squash,
      protection: player.protectionTimer > 0,
      shieldStacks: player.shieldStacks,
    });
    ctx.restore();

    // Ground
    if (player.currentWorld === 'MISSION') {
      ctx.fillStyle = player.isDiving ? 'rgba(26, 13, 8, 0.4)' : 'rgba(26, 13, 8, 0.8)';
      ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);
      ctx.strokeStyle = 'rgba(255, 78, 0, 0.3)';
    } else if (player.currentWorld === 'AQUATIC') {
      ctx.fillStyle = player.isDiving ? 'rgba(8, 47, 73, 0.4)' : 'rgba(12, 74, 110, 0.9)';
      ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
    } else {
      // Lunar surface / Lava surface
      ctx.fillStyle = player.isDiving ? 'rgba(31, 41, 55, 0.4)' : (player.currentWorld === 'LAVA' ? 'rgba(69, 10, 10, 0.9)' : 'rgba(15, 23, 42, 0.9)');
      ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);
      ctx.strokeStyle = player.currentWorld === 'LAVA' ? 'rgba(248, 113, 113, 0.3)' : 'rgba(0, 204, 255, 0.3)';
    }
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
    ctx.stroke();

    // Finish Line Rendering
    if (finishLineRef.current.active) {
      const fx = finishLineRef.current.x;
      const fWidth = 40;
      
      // Draw checkered pattern
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.fillRect(fx, 0, fWidth, GROUND_Y);
      
      ctx.fillStyle = '#000';
      const cellSize = 10;
      for (let y = 0; y < GROUND_Y; y += cellSize) {
        for (let x = 0; x < fWidth; x += cellSize) {
          if ((Math.floor(x / cellSize) + Math.floor(y / cellSize)) % 2 === 1) {
            ctx.fillRect(fx + x, y, cellSize, cellSize);
          }
        }
      }
      
      // Glow
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#fff';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(fx, 0, fWidth, GROUND_Y);
      ctx.restore();
    }

    // Boss
    if (bossRef.current) {
      const boss = bossRef.current;
      ctx.save();

      if (boss.isDying) {
        ctx.translate((Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15);
        if (frameCountRef.current % 4 === 0) ctx.globalAlpha = 0.4;
      }
      
      ctx.translate(boss.x + boss.width/2, boss.y + boss.height/2);
      
      // Glow
      ctx.shadowBlur = 30;
      ctx.shadowColor = boss.type === 'DREAM_EATER' ? '#ff00ff' : '#00ffff';
      
      if (boss.type === 'DREAM_EATER') {
        // Dream Eater shape (Large floating cloud-like monster)
        ctx.fillStyle = '#4a004a';
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const r = boss.width / 2 + Math.sin(frameCountRef.current * 0.1 + i) * 10;
          ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        }
        ctx.closePath();
        ctx.fill();

        // Hit Flash
        if (boss.hitFlashAlpha && boss.hitFlashAlpha > 0) {
          ctx.save();
          ctx.globalAlpha = boss.hitFlashAlpha;
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const r = boss.width / 2 + Math.sin(frameCountRef.current * 0.1 + i) * 10;
            ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        
        // Eyes
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(-20, -10, 10, 0, Math.PI * 2);
        ctx.arc(20, -10, 10, 0, Math.PI * 2);
        ctx.fill();
      } else if (boss.type === 'COSMIC_VOID') {
        // Cosmic Void shape (Large geometric star-like monster)
        ctx.fillStyle = '#000033';
        ctx.beginPath();
        for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * Math.PI * 2;
          const r = i % 2 === 0 ? boss.width / 2 : boss.width / 4;
          const pulse = Math.sin(frameCountRef.current * 0.1) * 10;
          ctx.lineTo(Math.cos(angle) * (r + pulse), Math.sin(angle) * (r + pulse));
        }
        ctx.closePath();
        ctx.fill();

        // Hit Flash
        if (boss.hitFlashAlpha && boss.hitFlashAlpha > 0) {
          ctx.save();
          ctx.globalAlpha = boss.hitFlashAlpha;
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const r = i % 2 === 0 ? boss.width / 2 : boss.width / 4;
            const pulse = Math.sin(frameCountRef.current * 0.1) * 10;
            ctx.lineTo(Math.cos(angle) * (r + pulse), Math.sin(angle) * (r + pulse));
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        
        // Core
        ctx.fillStyle = '#00ffff';
        ctx.beginPath();
        ctx.arc(0, 0, 20 + Math.sin(frameCountRef.current * 0.2) * 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (boss.type === 'KRAKEN') {
        // Kraken rendering (True Kraken/Squid Style)
        ctx.fillStyle = '#164e63'; 
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 35;

        // Mantle Base / Webbing (Connecting tentacles)
        ctx.save();
        ctx.fillStyle = '#164e63';
        ctx.beginPath();
        ctx.arc(0, 0, boss.width / 2.5, 0, Math.PI * 2);
        ctx.fill();
        // Webbing detail
        ctx.strokeStyle = '#155e75';
        ctx.lineWidth = 8;
        for(let i=0; i<8; i++) {
          const angle = (i/8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(0,0);
          ctx.lineTo(Math.cos(angle) * (boss.width/2), Math.sin(angle) * (boss.width/2));
          ctx.stroke();
        }
        ctx.restore();

        // Fluid Tentacle Logic
        if (boss.tentacles) {
          const attackSurge = Math.max(0, (100 - boss.attackTimer) / 100);
          
          boss.tentacles.forEach((t, i) => {
            ctx.save();
            // Multi-layered movement for fluid feel
            const wave1 = Math.sin(frameCountRef.current * 0.05 + i * 0.8) * 0.3;
            const wave2 = Math.cos(frameCountRef.current * 0.03 + i * 1.5) * 0.15;
            const combatWave = Math.sin(frameCountRef.current * 0.15 + i) * attackSurge * 0.5;
            
            ctx.rotate(t.angle + wave1 + wave2 + combatWave);
            
            // Primary Hunting Tentacles (longer and more glowy)
            const isHuntingArm = (i % 4 === 0);
            const armLen = t.length * (isHuntingArm ? 1.6 : 1); // Significantly longer hunting arms
            
            ctx.fillStyle = i % 2 === 0 ? '#164e63' : '#155e75';
            ctx.strokeStyle = isHuntingArm ? '#06b6d4' : '#0e7490';
            ctx.lineWidth = isHuntingArm ? 14 : 10; // Significantly thicker tentacles
            
            ctx.beginPath();
            ctx.moveTo(0, 0);
            
            const segments = 12; // More segments for smoother curves
            const totalLen = armLen + Math.sin(frameCountRef.current * 0.1) * 20;
            const segmentLen = totalLen / segments;
            
            let lastX = 0;
            let lastY = 0;
            
            for(let j=1; j<=segments; j++) {
              // Sine wave harmonics for serpentine motion
              const distFactor = j / segments;
              const intensity = (15 + attackSurge * 30) * distFactor;
              const curWave = Math.sin(frameCountRef.current * 0.08 + (j * 0.5) + i) * intensity;
              
              const targetX = j * segmentLen;
              const targetY = curWave;
              
              ctx.quadraticCurveTo(lastX + segmentLen/2, lastY, targetX, targetY);
              
              lastX = targetX;
              lastY = targetY;

              // Suckers (More frequent and detailed)
              if (j % 2 === 0 && j < segments - 2) {
                ctx.save();
                ctx.translate(targetX, targetY);
                ctx.fillStyle = isHuntingArm ? '#22d3ee' : '#0891b2';
                ctx.globalAlpha = 0.8;
                ctx.beginPath(); 
                ctx.arc(0, 5, 8 - distFactor * 4, 0, Math.PI*2); // Thicker suckers
                ctx.fill();
                ctx.restore();
              }
            }
            
            ctx.lineCap = 'round';
            ctx.stroke();
            ctx.restore();
          });
        }

        // Elongated Kraken Mantle (Head)
        ctx.save();
        const floatY = Math.sin(frameCountRef.current * 0.04) * 12;
        ctx.translate(0, floatY);
        
        ctx.fillStyle = '#164e63';
        ctx.beginPath();
        // Pointed top for a squid/kraken look
        ctx.moveTo(-boss.width / 2, 0);
        ctx.quadraticCurveTo(-boss.width / 2.5, -boss.height / 1.2, 0, -boss.height); // Mantle top
        ctx.quadraticCurveTo(boss.width / 2.5, -boss.height / 1.2, boss.width / 2, 0);
        ctx.lineTo(-boss.width / 2, 0);
        ctx.fill();

        // Fin Ridges
        ctx.fillStyle = '#155e75';
        ctx.beginPath();
        ctx.moveTo(-boss.width / 2.5, -boss.height / 2);
        ctx.lineTo(-boss.width / 1.5, -boss.height / 1.5);
        ctx.lineTo(-boss.width / 2.5, -boss.height / 1.2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(boss.width / 2.5, -boss.height / 2);
        ctx.lineTo(boss.width / 1.5, -boss.height / 1.5);
        ctx.lineTo(boss.width / 2.5, -boss.height / 1.2);
        ctx.fill();

        // Shaded underside and mouth area
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(0, 0, boss.width / 2, boss.height / 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Bioluminescence Patterns
        ctx.fillStyle = '#22d3ee';
        ctx.globalAlpha = 0.7;
        for(let i=0; i<20; i++) {
          const tx = Math.sin(i * 1.8) * (boss.width/3);
          const ty = -Math.random() * boss.height;
          ctx.beginPath();
          ctx.arc(tx, ty, 3 + Math.sin(frameCountRef.current * 0.1 + i) * 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1.0;

        // Large Menacing Eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(-35, -15, 22, 18, 0.3, 0, Math.PI * 2);
        ctx.ellipse(35, -15, 22, 18, -0.3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#000';
        const eyeX = Math.cos(frameCountRef.current * 0.02) * 8;
        const eyeY = Math.sin(frameCountRef.current * 0.01) * 4;
        ctx.beginPath();
        ctx.arc(-35 + eyeX, -15 + eyeY, 10, 0, Math.PI * 2);
        ctx.arc(35 + eyeX, -15 + eyeY, 10, 0, Math.PI * 2);
        ctx.fill();
        
        // Pupil slits for more "beastly" look
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-35 + eyeX, -25 + eyeY); ctx.lineTo(-35 + eyeX, -5 + eyeY);
        ctx.moveTo(35 + eyeX, -25 + eyeY); ctx.lineTo(35 + eyeX, -5 + eyeY);
        ctx.stroke();
        
        ctx.restore();
      } else if (boss.type === 'LAVA_DINO') {
        // Lava Dinosaur rendering (Refined anatomy)
        ctx.save();
        const floatY = Math.sin(frameCountRef.current * 0.06) * 6;
        ctx.translate(0, floatY);
        
        // Face the player
        if (player.x < boss.x) {
            ctx.scale(-1, 1);
        }
        
        ctx.fillStyle = '#7f1d1d';
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 25;

        // Tail (More muscular and tapered)
        ctx.beginPath();
        ctx.moveTo(-boss.width/3, 10);
        const tailFlex = Math.sin(frameCountRef.current * 0.1) * 30;
        ctx.quadraticCurveTo(-boss.width * 1.2, 40 + tailFlex, -boss.width / 4, 50);
        ctx.lineTo(-boss.width/4, 20);
        ctx.fillStyle = '#991b1b';
        ctx.fill();

        // Body (Powerful Prehistoric Torso)
        ctx.beginPath();
        // Shift weight towards back
        ctx.moveTo(-boss.width / 2.5, 0);
        ctx.bezierCurveTo(-boss.width / 2, 60, boss.width / 3, 60, boss.width / 3, 0);
        ctx.bezierCurveTo(boss.width / 3, -40, -boss.width / 4, -40, -boss.width / 2.5, 0);
        ctx.fillStyle = '#7f1d1d';
        ctx.fill();

        // Magma Core in stomach
        const corePulse = Math.sin(frameCountRef.current * 0.15) * 12;
        const grad = ctx.createRadialGradient(0, 25, 0, 0, 25, 45 + corePulse);
        grad.addColorStop(0, '#fef08a');
        grad.addColorStop(0.4, '#ea580c');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 25, 45 + corePulse, 0, Math.PI * 2);
        ctx.fill();

        // Spikes on back (Thermal radiators)
        ctx.fillStyle = '#450a0a';
        for(let i=0; i<6; i++) {
            const sx = -boss.width/3 + i * (boss.width/6);
            const sy = -30 - Math.abs(Math.sin(i*1.2))*15;
            ctx.beginPath();
            ctx.moveTo(sx - 12, -20);
            ctx.lineTo(sx, sy);
            ctx.lineTo(sx + 12, -20);
            ctx.fill();
        }

        // Tiny T-Rex Arms
        ctx.strokeStyle = '#450a0a';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(boss.width / 4, 10);
        ctx.lineTo(boss.width / 4 + 20, 25);
        ctx.lineTo(boss.width / 4 + 15, 35);
        ctx.stroke();

        // Legs (Muscular pillars)
        ctx.fillStyle = '#450a0a';
        ctx.roundRect(-45, 40, 35, 50, 10);
        ctx.roundRect(15, 40, 35, 50, 10);
        ctx.fill();

        // Neck & Head (Formidable Predator)
        ctx.save();
        ctx.translate(boss.width/3, -5);
        const headWobble = Math.sin(frameCountRef.current*0.08)*0.15;
        ctx.rotate(-0.15 + headWobble);
        
        // Rugged Neck
        ctx.fillStyle = '#7f1d1d';
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(20, -20);
        ctx.lineTo(40, 20);
        ctx.lineTo(0, 40);
        ctx.fill();
        
        // Massive Head / Skull
        ctx.beginPath();
        ctx.roundRect(-5, -45, 85, 55, 12);
        ctx.fill();
        
        // Lower Jaw (Hinged)
        ctx.save();
        ctx.translate(0, 5);
        ctx.rotate(Math.abs(Math.sin(frameCountRef.current * 0.1)) * 0.2); // Chewing/Roaring motion
        ctx.beginPath();
        ctx.roundRect(-5, 0, 75, 25, 8);
        ctx.fill();
        
        // Teeth (Razor Sharp)
        ctx.fillStyle = '#fff';
        for(let i=0; i<5; i++) {
            ctx.beginPath();
            ctx.moveTo(15 + i*14, 0);
            ctx.lineTo(22 + i*14, 10);
            ctx.lineTo(29 + i*14, 0);
            ctx.fill();
        }
        ctx.restore();
        
        // Menacing Glowing Eye
        ctx.fillStyle = '#fbbf24';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ea580c';
        ctx.beginPath(); ctx.arc(50, -25, 8, 0, Math.PI*2); ctx.fill();
        // Slit Pupil
        ctx.fillStyle = '#000';
        ctx.fillRect(49, -30, 2, 10);
        
        ctx.restore();
        ctx.restore();
      }
      
      // Health Bar
      ctx.restore();
      if (!boss.isDying) {
        ctx.save();
        ctx.fillStyle = '#333';
        ctx.fillRect(boss.x, boss.y - 40, boss.width, 10);
        
        // Health segments
        const healthWidth = (boss.health / boss.maxHealth) * boss.width;
        ctx.fillStyle = boss.phase === 1 ? '#00ff00' : (boss.phase === 2 ? '#ffcc00' : '#ff0000');
        ctx.fillRect(boss.x, boss.y - 40, healthWidth, 10);
        
        // Border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(boss.x, boss.y - 40, boss.width, 10);
        
        // Phase Text
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`PHASE ${boss.phase}`, boss.x + boss.width/2, boss.y - 45);
        
        // Phase markers
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.moveTo(boss.x + boss.width * 0.3, boss.y - 40);
        ctx.lineTo(boss.x + boss.width * 0.3, boss.y - 30);
        ctx.moveTo(boss.x + boss.width * 0.7, boss.y - 40);
        ctx.lineTo(boss.x + boss.width * 0.7, boss.y - 30);
        ctx.stroke();
        
        ctx.restore();
      }
    }

    // Power-ups
    powerUpsRef.current.forEach(p => {
      ctx.save();
      ctx.translate(p.x + p.width/2, p.y + p.height/2);
      
      if (p.type === 'star') {
        const mainColor = currentWorld === 'MISSION' ? '#facc15' : '#00ffff';
        ctx.fillStyle = mainColor;
        ctx.shadowBlur = 15;
        ctx.shadowColor = mainColor;
        ctx.beginPath();
        for(let i=0; i<5; i++) {
          const angle = (i * 0.8) * Math.PI - Math.PI/2;
          ctx.lineTo(Math.cos(angle) * p.width/2, Math.sin(angle) * p.height/2);
          const angle2 = (i * 0.8 + 0.4) * Math.PI - Math.PI/2;
          ctx.lineTo(Math.cos(angle2) * p.width/4, Math.sin(angle2) * p.height/4);
        }
        ctx.closePath();
        ctx.fill();
      } else if (p.type === 'shield') {
        const shieldColor = currentWorld === 'MISSION' ? '#00ccff' : '#a855f7';
        ctx.strokeStyle = shieldColor;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 10;
        ctx.shadowColor = shieldColor;
        ctx.beginPath();
        ctx.arc(0, 0, p.width/2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = currentWorld === 'MISSION' ? 'rgba(0, 204, 255, 0.2)' : 'rgba(168, 85, 247, 0.2)';
        ctx.fill();
        // Inner icon
        ctx.fillStyle = shieldColor;
        ctx.beginPath();
        ctx.roundRect(-5, -5, 10, 10, 2);
        ctx.fill();
      } else if (p.type === 'feather') {
        const plumeColor = '#00ffff';
        ctx.save();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 15;
        ctx.shadowColor = plumeColor;
        
        // Wind symbol (replacing feather)
        ctx.beginPath();
        const centerX = 0;
        const centerY = 0;
        ctx.moveTo(centerX - 12, centerY - 6);
        ctx.quadraticCurveTo(centerX, centerY - 18, centerX + 12, centerY - 6);
        ctx.moveTo(centerX - 14, centerY);
        ctx.quadraticCurveTo(centerX, centerY - 12, centerX + 14, centerY);
        ctx.moveTo(centerX - 12, centerY + 6);
        ctx.quadraticCurveTo(centerX, centerY - 6, centerX + 12, centerY + 6);
        ctx.stroke();
        ctx.restore();
      }
      
      ctx.restore();
    });

    // Scarier Obstacles
    obstaclesRef.current.forEach(obs => {
      ctx.globalAlpha = 1.0;
      ctx.save();
      ctx.translate(obs.x + obs.width / 2, obs.y + obs.height / 2);
      
      if (obs.type === 'pillow') {
        // Nightmarish Eye Orb
        const pulse = Math.sin(frameCountRef.current * 0.1) * 2;
        const mainColor = currentWorld === 'MISSION' ? '#1e1b4b' : '#334155';
        const accentColor = currentWorld === 'MISSION' ? '#ef4444' : '#06b6d4';
        
        ctx.fillStyle = mainColor;
        ctx.beginPath();
        ctx.arc(0, 0, obs.width / 2 + pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        // Eye
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = accentColor;
        ctx.beginPath();
        ctx.arc(Math.cos(frameCountRef.current * 0.05) * 3, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (obs.type === 'clock') {
        // Distorted Ancient Clock
        const accentColor = currentWorld === 'MISSION' ? '#fde047' : '#00ffff';
        ctx.rotate(Math.sin(frameCountRef.current * 0.1) * 0.2);
        ctx.fillStyle = currentWorld === 'MISSION' ? '#0f172a' : '#1e1b4b';
        ctx.beginPath();
        ctx.roundRect(-obs.width / 2, -obs.height / 2, obs.width, obs.height, 4);
        ctx.fill();
        // Glowing face
        ctx.fillStyle = currentWorld === 'MISSION' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(0, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.arc(0, 0, obs.width / 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 1;
        ctx.stroke();
        // Creepy hands
        ctx.strokeStyle = accentColor;
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(0, -15);
        ctx.moveTo(0, 0); ctx.lineTo(10, 5);
        ctx.stroke();
      } else if (obs.type === 'yarn') {
        // Shadow Entangler
        const accentColor = currentWorld === 'MISSION' ? '#a855f7' : '#0ea5e9';
        ctx.rotate(frameCountRef.current * 0.1);
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(0, 0, obs.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2;
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(ang) * (obs.width / 2 + 5), Math.sin(ang) * (obs.width / 2 + 5));
        }
        ctx.stroke();
      } else if (obs.type === 'tower') {
        // Void Monolith
        const accentColor = currentWorld === 'MISSION' ? '#ff4e00' : '#00f0ff';
        ctx.fillStyle = currentWorld === 'MISSION' ? '#020617' : '#0f172a';
        ctx.fillRect(-obs.width / 2, -obs.height / 2, obs.width, obs.height);
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(-obs.width / 2, -obs.height / 2, obs.width, obs.height);
        // Forbidden Runes
        ctx.fillStyle = accentColor;
        ctx.font = '8px monospace';
        for (let i = 0; i < 5; i++) {
          ctx.fillText(currentWorld === 'MISSION' ? 'VOID' : 'CORE', -10, -30 + i * 15);
        }
      } else if (obs.type === 'slipper') {
        // Ground Vortex
        const color1 = currentWorld === 'MISSION' ? '#000' : '#0f172a';
        const color2 = currentWorld === 'MISSION' ? '#1e1b4b' : '#312e81';
        const accent = currentWorld === 'MISSION' ? '#4f46e5' : '#06b6d4';
        
        ctx.rotate(frameCountRef.current * 0.2);
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, obs.width / 2);
        grad.addColorStop(0, color1);
        grad.addColorStop(1, color2);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(0, 0, obs.width / 2, obs.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.stroke();
      } else if (obs.type === 'bat') {
        const wingY = Math.sin(frameCountRef.current * 0.3) * 20;
        const mainColor = currentWorld === 'MISSION' ? '#4338ca' : '#1d4ed8';
        const wingColor = currentWorld === 'MISSION' ? '#312e81' : '#1e3a8a';
        const eyeColor = currentWorld === 'MISSION' ? '#ef4444' : '#00ffff';
        
        ctx.fillStyle = mainColor;
        ctx.beginPath(); // Ears
        ctx.moveTo(-10, -10); ctx.lineTo(-15, -25); ctx.lineTo(-5, -10);
        ctx.moveTo(10, -10); ctx.lineTo(15, -25); ctx.lineTo(5, -10);
        ctx.fill();
        ctx.beginPath(); // Body
        ctx.ellipse(0, 0, 10, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = wingColor;
        ctx.beginPath(); // Wings
        ctx.moveTo(-10, 0); ctx.quadraticCurveTo(-25, -wingY, -40, 0); ctx.lineTo(-10, 10);
        ctx.moveTo(10, 0); ctx.quadraticCurveTo(25, -wingY, 40, 0); ctx.lineTo(10, 10);
        ctx.fill();
        ctx.fillStyle = eyeColor;
        ctx.beginPath(); ctx.arc(-4, -4, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(4, -4, 2, 0, Math.PI * 2); ctx.fill();
      } else if (obs.type === 'ghost') {
        ctx.globalAlpha = 0.7;
        const wobbleX = Math.sin(frameCountRef.current * 0.1) * 10;
        ctx.translate(wobbleX, 0);
        ctx.fillStyle = currentWorld === 'MISSION' ? '#e2e8f0' : '#94a3b8';
        ctx.beginPath();
        ctx.arc(0, -obs.height / 4, obs.width / 2, Math.PI, 0);
        ctx.lineTo(obs.width / 2, obs.height / 2);
        for (let i = 0; i < 3; i++) {
          ctx.quadraticCurveTo(obs.width / 2 - (i + 0.5) * (obs.width / 3), obs.height / 2 + 10, obs.width / 2 - (i + 1) * (obs.width / 3), obs.height / 2);
        }
        ctx.lineTo(-obs.width / 2, -obs.height / 4);
        ctx.fill();
        ctx.fillStyle = currentWorld === 'MISSION' ? '#000' : '#0f172a';
        ctx.beginPath(); ctx.arc(-5, -5, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(5, -5, 3, 0, Math.PI * 2); ctx.fill();
      } else if (obs.type === 'shooter') {
        const pulse = 1 + Math.sin(frameCountRef.current * 0.1) * 0.1;
        const mainColor = currentWorld === 'MISSION' ? '#4c1d95' : '#1e40af';
        const ringColor = currentWorld === 'MISSION' ? '#a78bfa' : '#0ea5e9';
        
        ctx.scale(pulse, pulse);
        ctx.fillStyle = mainColor;
        ctx.shadowBlur = 20;
        ctx.shadowColor = ringColor;
        ctx.beginPath();
        ctx.roundRect(-obs.width / 2, -obs.height / 2, obs.width, obs.height, 15);
        ctx.fill();
        ctx.strokeStyle = ringColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 15 + Math.sin(frameCountRef.current * 0.2) * 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
      } else if (obs.type === 'cloud') {
        ctx.globalAlpha = 0.6;
        const color = currentWorld === 'MISSION' ? '#fff' : '#00ffff';
        ctx.fillStyle = color;
        ctx.shadowBlur = 20;
        ctx.shadowColor = color;
        ctx.beginPath();
        ctx.arc(-30, 0, 30, 0, Math.PI * 2);
        ctx.arc(0, -10, 40, 0, Math.PI * 2);
        ctx.arc(30, 0, 30, 0, Math.PI * 2);
        ctx.fill();
      } else if (obs.type === 'fear_wall') {
        const wallColor = currentWorld === 'MISSION' ? '#2d1a12' : '#000';
        const glowColor = currentWorld === 'MISSION' ? '#ef4444' : '#a855f7';
        ctx.fillStyle = wallColor;
        ctx.shadowBlur = 15;
        ctx.shadowColor = glowColor;
        ctx.beginPath();
        ctx.roundRect(-obs.width / 2, -obs.height / 2, obs.width, obs.height, 8);
        ctx.fill();
        // Spikes
        ctx.strokeStyle = glowColor;
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.moveTo(-obs.width / 2, -obs.height / 2 + i * 40);
          ctx.lineTo(-obs.width / 2 - 10, -obs.height / 2 + i * 40 + 20);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(obs.width / 2, -obs.height / 2 + i * 40 + 10);
          ctx.lineTo(obs.width / 2 + 10, -obs.height / 2 + i * 40 + 30);
          ctx.stroke();
        }
      } else if (obs.type === 'lava_wave') {
        const grad = ctx.createLinearGradient(0, -obs.height/2, 0, obs.height/2);
        grad.addColorStop(0, '#ff4e00');
        grad.addColorStop(1, '#ff0000');
        ctx.fillStyle = grad;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ff4e00';
        ctx.beginPath();
        ctx.roundRect(-obs.width/2, -obs.height/2, obs.width, obs.height, [20, 20, 0, 0]);
        ctx.fill();
        // Lava bubbles
        ctx.fillStyle = '#ffcc00';
        for (let i = 0; i < 3; i++) {
            const bx = -obs.width/2 + 20 + i * 30;
            const by = -obs.height/2 + 10 + Math.sin(frameCountRef.current * 0.1 + i) * 5;
            ctx.beginPath(); ctx.arc(bx, by, 5, 0, Math.PI*2); ctx.fill();
        }
      } else if (obs.type === 'ember') {
        ctx.fillStyle = '#ff4e00';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff4e00';
        ctx.beginPath();
        ctx.arc(0, 0, obs.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.arc(0, 0, obs.width / 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (obs.type === 'crumbling') {
        // Crumbling Platform: Cracked stone look
        const alpha = (obs.crumbleTimer !== undefined && obs.crumbleTimer < 30) ? 0.3 + (obs.crumbleTimer / 30) * 0.7 : 1.0;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#4b5563';
        ctx.fillRect(-obs.width/2, -obs.height/2, obs.width, obs.height);
        
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 1;
        ctx.strokeRect(-obs.width/2, -obs.height/2, obs.width, obs.height);
        
        // Cracks
        if (obs.crumbleTimer !== undefined && obs.crumbleTimer < 45) {
          ctx.beginPath();
          ctx.strokeStyle = '#000';
          ctx.moveTo(-20, -5); ctx.lineTo(10, 5);
          ctx.moveTo(0, -10); ctx.lineTo(-10, 10);
          ctx.stroke();
        }
      } else if (obs.type === 'conveyor') {
        // Conveyor Belt: Moving segments
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(-obs.width/2, -obs.height/2, obs.width, obs.height);
        
        const segmentSize = 20;
        const offset = (frameCountRef.current * (obs.conveyorSpeed || 1)) % segmentSize;
        ctx.fillStyle = '#374151';
        for (let i = -obs.width/2 - segmentSize; i < obs.width/2 + segmentSize; i += segmentSize) {
          ctx.fillRect(i + offset, -obs.height/2, 10, obs.height);
        }
        
        // Arrows
        ctx.fillStyle = '#fbbf24';
        const dir = (obs.conveyorSpeed || 0) > 0 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(dir * 10, 0); ctx.lineTo(dir * -5, -5); ctx.lineTo(dir * -5, 5);
        ctx.fill();
      } else if (obs.type === 'spring_trap') {
        // Spring Trap: Coiled look
        ctx.fillStyle = '#4b5563';
        ctx.fillRect(-obs.width/2, 0, obs.width, obs.height/2);
        
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 2;
        const springH = 10 + Math.sin(frameCountRef.current * 0.2) * 5;
        ctx.beginPath();
        for(let i=0; i<3; i++) {
          ctx.moveTo(-10, -i*5); ctx.lineTo(10, -i*5 - 5);
        }
        ctx.stroke();
        
        // Plate on top
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-obs.width/2 - 5, -springH - 2, obs.width + 10, 4);
      }
      ctx.restore();
    });

    // Particles
    particlesRef.current.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.life;
      
      if (p.type === 'spark') {
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 5;
        ctx.shadowColor = p.color;
        ctx.fillRect(p.x, p.y, p.width, p.height);
      } else if (p.type === 'ambient') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.width/2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'smoke') {
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.width/2);
        grad.addColorStop(0, 'rgba(100, 100, 100, 0.4)');
        grad.addColorStop(1, 'rgba(100, 100, 100, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.width/2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'fire') {
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.width/2);
        grad.addColorStop(0, '#ffff00');
        grad.addColorStop(0.4, '#ff4400');
        grad.addColorStop(1, 'rgba(255, 68, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.width/2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.width, p.height);
      }
      
      ctx.restore();
    });

    // Collect Effects
    collectEffectsRef.current.forEach(eff => {
      ctx.save();
      ctx.globalAlpha = eff.life;
      ctx.strokeStyle = eff.color;
      ctx.lineWidth = 4;
      ctx.shadowBlur = 20;
      ctx.shadowColor = eff.color;
      ctx.beginPath();
      ctx.arc(eff.x, eff.y, eff.radius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Inner glow
      ctx.globalAlpha = eff.life * 0.3;
      ctx.fillStyle = eff.color;
      ctx.fill();
      ctx.restore();
    });

    // Player Bullets Draw
    playerBulletsRef.current.forEach(bul => {
      ctx.save();
      ctx.translate(bul.x + bul.width/2, bul.y + bul.height/2);
      ctx.rotate(Math.atan2(bul.vy || 0, bul.vx));
      
      // Outer glow
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#00ffff';
      ctx.fillStyle = '#fff';
      
      // Rocket/Bullet shape
      ctx.beginPath();
      ctx.roundRect(-bul.width/2, -bul.height/2, bul.width, bul.height, 4);
      ctx.fill();
      
      // Engine flare
      ctx.fillStyle = '#00ffff';
      ctx.beginPath();
      ctx.moveTo(-bul.width/2, -bul.height/4);
      ctx.lineTo(-bul.width/2 - 10 - Math.random() * 5, 0);
      ctx.lineTo(-bul.width/2, bul.height/4);
      ctx.fill();
      
      ctx.restore();
    });

    // Targeting Crosshair
    if (player.lockedTargetId !== null) {
       const bossTarget = (bossRef.current && bossRef.current.id === player.lockedTargetId) ? bossRef.current : null;
       const obsTarget = obstaclesRef.current.find(o => o.id === player.lockedTargetId);
       const target = bossTarget || obsTarget;

       if (target) {
         ctx.save();
         ctx.strokeStyle = '#ff0000';
         ctx.lineWidth = 2;
         ctx.shadowBlur = 10;
         ctx.shadowColor = '#ff0000';
         ctx.setLineDash([5, 5]);
         const time = frameCountRef.current * 0.1;
         
         ctx.translate(target.x + target.width/2, target.y + target.height/2);
         ctx.rotate(time);
         
         // Diamond crosshair
         ctx.beginPath();
         ctx.moveTo(-25, 0); ctx.lineTo(0, -25);
         ctx.lineTo(25, 0); ctx.lineTo(0, 25);
         ctx.closePath();
         ctx.stroke();
         
         // Inner circle
         ctx.setLineDash([]);
         ctx.beginPath();
         ctx.arc(0, 0, 10 + Math.sin(time*2)*4, 0, Math.PI * 2);
         ctx.stroke();
         
         ctx.restore();
       }
    }

    // Projectiles
    projectilesRef.current.forEach(proj => {
      // Draw Trail
      if (proj.trail && proj.trail.length > 1) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(proj.trail[0].x, proj.trail[0].y);
        for (let i = 1; i < proj.trail.length; i++) {
          ctx.lineTo(proj.trail[i].x, proj.trail[i].y);
        }
        let trailColor = proj.isHarmless ? 'rgba(0, 255, 255, 0.4)' : 'rgba(255, 78, 0, 0.4)';
        if (proj.projType === 'spike') trailColor = 'rgba(168, 85, 247, 0.4)';
        if (proj.projType === 'ink') trailColor = 'rgba(0, 0, 0, 0.6)';
        if (proj.projType === 'bubble') trailColor = 'rgba(255, 255, 255, 0.3)';

        ctx.strokeStyle = trailColor;
        ctx.lineWidth = proj.width * 0.6;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(proj.x + proj.width/2, proj.y + proj.height/2);
      
      if (proj.projType === 'spike') {
          // Purple Spike
          ctx.fillStyle = '#a855f7';
          ctx.rotate(Math.atan2(proj.vy, proj.vx));
          ctx.beginPath();
          ctx.moveTo(proj.width/2, 0);
          ctx.lineTo(-proj.width/2, -proj.height/4);
          ctx.lineTo(-proj.width/2, proj.height/4);
          ctx.closePath();
          ctx.fill();
          ctx.shadowBlur = 15;
          ctx.shadowColor = '#d946ef';
          ctx.stroke();
      } else if (proj.projType === 'fireball') {
          // Fireball
          const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, proj.width/2);
          grad.addColorStop(0, '#fff');
          grad.addColorStop(0.3, '#fbbf24');
          grad.addColorStop(1, '#ef4444');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(0, 0, proj.width/2, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 20;
          ctx.shadowColor = '#f59e0b';
      } else if (proj.projType === 'ink') {
          // Ink Blob
          ctx.fillStyle = '#000';
          ctx.beginPath();
          for(let i=0; i<6; i++) {
              const ang = (i/6)*Math.PI*2;
              const r = proj.width/2 + Math.sin(frameCountRef.current*0.2 + i)*5;
              ctx.lineTo(Math.cos(ang)*r, Math.sin(ang)*r);
          }
          ctx.closePath();
          ctx.fill();
      } else if (proj.projType === 'bubble') {
          // Bubble
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.lineWidth = 2;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.beginPath();
          ctx.arc(0, 0, proj.width/2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // Highlight
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(-proj.width/4, -proj.width/4, 3, 0, Math.PI * 2);
          ctx.fill();
      } else {
          // Default
          ctx.fillStyle = proj.isHarmless ? '#00ffff' : '#ff4e00';
          ctx.shadowBlur = 10;
          ctx.shadowColor = proj.isHarmless ? '#00ffff' : '#ff4e00';
          ctx.beginPath();
          ctx.arc(0, 0, proj.width/2, 0, Math.PI * 2);
          ctx.fill();
      }
      ctx.restore();
    });

    // Draw Flash
    if (flashAlphaRef.current > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${flashAlphaRef.current})`;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      if (player.currentWorld === 'COSMIC' && flashAlphaRef.current > 0.5) {
        ctx.save();
        ctx.fillStyle = '#000';
        ctx.font = 'bold 48px Impact, Arial Black, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('WORLD 2: MOON BASE', CANVAS_WIDTH/2, CANVAS_HEIGHT/2);
        ctx.font = '24px Impact, Arial Black, sans-serif';
        ctx.fillText('DESTINATION: THE LUNAR SURFACE', CANVAS_WIDTH/2, CANVAS_HEIGHT/2 + 50);
        ctx.restore();
      }
    }

    // Deep Sleep Overlay
    if (player.isDeepSleep) {
      ctx.save();
      const grad = ctx.createRadialGradient(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, 0, CANVAS_WIDTH/2, CANVAS_HEIGHT/2, CANVAS_WIDTH);
      grad.addColorStop(0, 'rgba(168, 85, 247, 0)');
      grad.addColorStop(1, 'rgba(46, 16, 101, 0.4)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      // Spooky grain
      if (frameCountRef.current % 2 === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
        for(let i=0; i<20; i++) {
          ctx.fillRect(Math.random() * CANVAS_WIDTH, Math.random() * CANVAS_HEIGHT, 2, 2);
        }
      }
      ctx.restore();
    }

    // Damage Texts
    ctx.save();
    damageTextsRef.current.forEach(dt => {
      ctx.globalAlpha = dt.life;
      ctx.fillStyle = dt.color;
      ctx.font = `bold ${30 + (1 - dt.life) * 40}px Arial`;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.textAlign = 'center';
      ctx.strokeText(dt.text, dt.x, dt.y);
      ctx.fillText(dt.text, dt.x, dt.y);
    });
    ctx.restore();

    // Slashes Rendering
    slashesRef.current.forEach(s => {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rotation);
      ctx.globalAlpha = s.life;
      ctx.lineWidth = 4;
      ctx.strokeStyle = s.color;
      ctx.shadowBlur = 15;
      ctx.shadowColor = s.color;
      
      ctx.beginPath();
      ctx.moveTo(-s.width/2, 0);
      ctx.quadraticCurveTo(0, -s.height, s.width/2, 0);
      ctx.stroke();
      
      // Inner white flare
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-s.width/2.5, 0);
      ctx.quadraticCurveTo(0, -s.height * 0.8, s.width/2.5, 0);
      ctx.stroke();
      ctx.restore();
    });

    ctx.restore();

    // Combat HUD / Instructions
    ctx.save();
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.textAlign = 'right';
    ctx.fillText('MOVE: ARROW KEYS', CANVAS_WIDTH - 20, CANVAS_HEIGHT - 60);
    ctx.fillText('SHOOT: SHIFT (LOCK) / X (FREE)', CANVAS_WIDTH - 20, CANVAS_HEIGHT - 40);
    ctx.fillText('SKILL: SHIFT + Q', CANVAS_WIDTH - 20, CANVAS_HEIGHT - 20);
    
    // Flow Warning Overlay
    if (player.currentWorld === 'AQUATIC' && player.worldFlow.warningVisible) {
      ctx.save();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.font = 'bold 40px Arial Black';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#00ffff';
      const arrowMap = { 'left': '← FLOW ←', 'right': '→ FLOW →', 'up': '↑ FLOW ↑', 'down': '↓ FLOW ↓' };
      ctx.fillText(arrowMap[player.worldFlow.dir || 'left'], CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      ctx.restore();
    }
      if (player.combo > 1) {
        ctx.fillStyle = player.combo > 10 ? '#ffcc00' : '#fff';
        ctx.font = `italic black ${20 + Math.min(player.combo, 20)}px Arial`;
        ctx.textAlign = 'left';
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.fillText(`COMBO X${player.combo}`, 20, 140);
      }
    ctx.restore();

    // Post-Processing: Scanlines
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#000';
    for(let i=0; i<CANVAS_HEIGHT; i+=4) {
      ctx.fillRect(0, i, CANVAS_WIDTH, 1);
    }
    ctx.restore();
    
    // Vignette
    const vignette = ctx.createRadialGradient(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, CANVAS_WIDTH*0.3, CANVAS_WIDTH/2, CANVAS_HEIGHT/2, CANVAS_WIDTH*0.6);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.restore(); // End Camera Transform
  }, [CANVAS_WIDTH, CANVAS_HEIGHT, GROUND_Y, selectedCharacterId, isMuted]); 

  const loop = useCallback(() => {
    if (impactPauseRef.current > 0) {
      impactPauseRef.current--;
    } else {
      // Loop updates multiple times if timeScale is > 1? 
      // Actually easier to just multiply delta-based updates.
      // But this game is frame-based. So we'll run update once and handle scale inside it.
      update();
    }
    
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) draw(ctx);
    requestRef.current = requestAnimationFrame(loop);
  }, [update, draw]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [loop]);

  useEffect(() => {
    if (score > highScore) setHighScore(score);
  }, [score, highScore]);

  const executeJump = useCallback(() => {
    const player = playerRef.current;
    if (!player.isJumping || player.coyoteTime > 0) {
      player.vy = JUMP_FORCE;
      player.isJumping = true;
      player.canDoubleJump = true;
      player.isDiving = false;
      player.divingTimer = 0;
      player.coyoteTime = 0;
      playProceduralSound('jump', isMuted);
      createParticles(player.x + player.width / 2, player.y + player.height, '#ffffff', 'spark');
    } else if (player.canDoubleJump) {
      player.vy = JUMP_FORCE;
      playProceduralSound('jump', isMuted);
      if (player.featherCharges > 0) {
        player.canDoubleJump = true; 
        player.featherCharges -= 1;
      } else {
        player.canDoubleJump = false;
      }
      createParticles(player.x + player.width / 2, player.y + player.height, '#ffffff', 'spark');
    }
  }, [isMuted]);

  // --- Input ---
  const handleKeyDown = useCallback((e: KeyboardEvent | { code: string, key?: string, preventDefault: () => void }) => {
    keysRef.current[e.code] = true;
    // Fallback for some environments
    if (e.key === 'ArrowUp') keysRef.current['ArrowUp'] = true;
    if (e.key === 'ArrowDown') keysRef.current['ArrowDown'] = true;
    if (e.key === 'ArrowLeft') keysRef.current['ArrowLeft'] = true;
    if (e.key === 'ArrowRight') keysRef.current['ArrowRight'] = true;

    // Force focus on canvas if possible (indirectly)
    if (gameState === 'PLAYING') {
      // Accessibility scroll prevention
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    }

    if (['Space', 'ArrowUp', 'KeyW', 'VirtualUp'].includes(e.code)) {
      if (gameState === 'PLAYING') {
        // Prevent default scrolling for space/arrows
        if (['Space', 'ArrowUp'].includes(e.code)) e.preventDefault();
        executeJump();
      } else if (gameState === 'START' || gameState === 'GAMEOVER') {
        resetGame();
      }
    }
    if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'VirtualDown') {
      if (gameState === 'PLAYING' && !playerRef.current.isDiving) {
        playerRef.current.isDiving = true;
        playerRef.current.divingTimer = 120; // 2 seconds at 60fps
        playerRef.current.hasImpacted = false;
        playerRef.current.isJumping = false;
        playerRef.current.vy = 0;
        playProceduralSound('dive', isMuted);
      }
    }
    if (e.code === 'KeyQ' || e.code === 'VirtualQ') {
      if (gameState === 'PLAYING') {
        const player = playerRef.current;
        if (player.skillCooldown <= 0) {
          // Trigger Unique Ultimate
          if (selectedCharacterId === 4) {
            // Siamese: Teleport dash
            player.x += 250;
            player.skillCooldown = 300; // 5s
            createParticles(player.x - 250, player.y + player.height/2, '#00ffff', 'spark');
            createParticles(player.x, player.y + player.height/2, '#ffffff', 'fire');
            createDamageText(player.x, player.y - 20, 'TELEPORT!', '#00ffff');
            playProceduralSound('powerup', isMuted);
          } else if (selectedCharacterId === 6) {
            // Bengal: Roar (clear nearby)
            shakeOffsetRef.current = { x: 15, y: 15 };
            obstaclesRef.current = obstaclesRef.current.filter(obs => {
              const dx = (obs.x + obs.width/2) - (player.x + player.width/2);
              if (dx > -100 && dx < 400) {
                createParticles(obs.x + obs.width/2, obs.y + obs.height/2, '#ff4e00', 'fire');
                if (obs.type === 'shooter') {
                  projectilesRef.current = projectilesRef.current.filter(p => p.sourceId !== obs.id);
                }
                return false;
              }
              return true;
            });
            player.skillCooldown = 600; // 10s
            createDamageText(player.x, player.y - 40, 'ROAR!', '#ff4e00');
            playProceduralSound('boss', isMuted); 
            // Visual Slash Burst for Bengal too? User said Q should slash.
            for(let i=0; i<3; i++) createSlash(player.x + player.width/2 + (Math.random()-0.5)*100, player.y + player.height/2 + (Math.random()-0.5)*100, '#ff4e00');
          } else if (selectedCharacterId === 7) {
            // Void Panther: Black Hole (Magnet)
            player.skillActive = 300; // 5s active
            player.skillCooldown = 950; // slightly longer
            createDamageText(player.x, player.y - 40, 'SINGULARITY!', '#ff4e00');
            playProceduralSound('powerup', isMuted);
            
            // Slash Burst Activation
            for(let i=0; i<5; i++) {
              createSlash(player.x + player.width/2 + (Math.random()-0.5)*150, player.y + player.height/2 + (Math.random()-0.5)*150, '#ff4e00');
            }
          }
        }
      }
    }
    if (e.code === 'KeyP') {
      setGameState(prev => prev === 'PLAYING' ? 'PAUSED' : prev === 'PAUSED' ? 'PLAYING' : prev);
    }
    if (e.code === 'KeyF' || e.code === 'KeyX' || e.code === 'ShiftLeft' || e.code === 'VirtualX') {
      if (gameState === 'PLAYING') {
        const player = playerRef.current;
        
        if (e.code === 'ShiftLeft') {
          if (player.lockedTargetId === null) {
            // Priority 1: Boss
            if (bossRef.current && bossRef.current.active) {
              player.lockedTargetId = bossRef.current.id;
            } else {
              // Priority 2: Most threatful ENEMIES
              let bestTarget: Obstacle | null = null;
            let minDist = Infinity;
            obstaclesRef.current.forEach(obs => {
              if (obs.category !== 'enemy') return;
              const dx = obs.x - player.x;
              // Target as soon as they come into view or are in front
              if (obs.x < CANVAS_WIDTH && dx > -50 && dx < minDist) {
                minDist = dx;
                bestTarget = obs;
              }
            });
            if (bestTarget) {
              player.lockedTargetId = (bestTarget as Obstacle).id;
            }
          }
        } else {
            // Fire at locked target
            fireBullet(player.lockedTargetId);
          }
        } else if (e.code === 'KeyF') {
          // Cycle red circle to another enemy threat
          const targets: { id: number, x: number }[] = [
             ...(bossRef.current ? [{ id: bossRef.current.id, x: bossRef.current.x }] : []),
             ...obstaclesRef.current.filter(o => o.category === 'enemy' && o.x < CANVAS_WIDTH && o.x > player.x - 50).map(t => ({ id: t.id, x: t.x }))
          ].sort((a,b) => a.x - b.x);

          if (targets.length > 0) {
            if (player.lockedTargetId === null) {
              player.lockedTargetId = targets[0].id;
            } else {
              const currentIndex = targets.findIndex(t => t.id === player.lockedTargetId);
              const nextIndex = (currentIndex + 1) % targets.length;
              player.lockedTargetId = targets[nextIndex].id;
            }
          }
        } else if (e.code === 'KeyX' || e.code === 'VirtualX') {
          fireBullet();
        }
      }
    }
    if (e.code === 'KeyR') {
      resetGame();
    }
  }, [gameState, resetGame, isMuted, executeJump, selectedCharacterId]);

  const handleKeyUp = useCallback((e: KeyboardEvent | { code: string, key?: string }) => {
    keysRef.current[e.code] = false;
    if (e.key === 'ArrowUp') keysRef.current['ArrowUp'] = false;
    if (e.key === 'ArrowDown') keysRef.current['ArrowDown'] = false;
    if (e.key === 'ArrowLeft') keysRef.current['ArrowLeft'] = false;
    if (e.key === 'ArrowRight') keysRef.current['ArrowRight'] = false;
  }, []);

  useEffect(() => {
    const handleBlur = () => {
      keysRef.current = {};
    };

    window.addEventListener('keydown', handleKeyDown as any);
    window.addEventListener('keyup', handleKeyUp as any);
    window.addEventListener('blur', handleBlur);
    // Add Gyroscope Support
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (!isGyroActive || !e.beta || !e.gamma) return;
      // beta: front/back (-180 to 180), gamma: left/right (-90 to 90)
      if (Math.abs(e.gamma) > 10) {
        if (e.gamma > 0) {
          keysRef.current['ArrowRight'] = true;
          keysRef.current['ArrowLeft'] = false;
        } else {
          keysRef.current['ArrowLeft'] = true;
          keysRef.current['ArrowRight'] = false;
        }
      } else {
        keysRef.current['ArrowLeft'] = false;
        keysRef.current['ArrowRight'] = true;
      }
      
      if (e.beta > 45) {
         keysRef.current['ArrowDown'] = true;
      } else {
         keysRef.current['ArrowDown'] = false;
      }
    };

    if (isGyroActive) {
      window.addEventListener('deviceorientation', handleOrientation);
    }
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown as any);
      window.removeEventListener('keyup', handleKeyUp as any);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [handleKeyDown, handleKeyUp, isGyroActive]);

  const getUpgradePrice = (up: Upgrade, currentLvl: number) => {
    // Each level gets progressively more expensive (exponentially steeper)
    return Math.floor(up.price * Math.pow(1.8, currentLvl));
  };

  const selectedChar = CHARACTERS.find(c => c.id === selectedCharacterId) || CHARACTERS[0];
  const maxH = 100 + (upgradeLevels.health || 0) * 20 + (selectedChar.extraStats?.maxHealth || 0);
  const maxE = 100 + (upgradeLevels.energy || 0) * 20 + (selectedChar.extraStats?.maxEnergy || 0);

  // HUD Scaling Factors - Bars get longer based on stats
  const healthBarWidth = 140 + (maxH - 100) * 1.5; 
  const energyBarWidth = 140 + (maxE - 100) * 1.2;

  return (
    <div className="fixed inset-0 bg-[#0a0502] text-white overflow-hidden select-none">
      {/* Game Container - Mandatory Full Screen */}
      <div 
        ref={containerRef}
        className="relative w-full h-full bg-black overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full block"
          onClick={() => {
            if (gameState === 'PLAYING') {
              if (!playerRef.current.isJumping) {
                playerRef.current.vy = JUMP_FORCE;
                playerRef.current.isJumping = true;
              }
            } else if (gameState === 'START' || gameState === 'GAMEOVER') {
              resetGame();
            }
          }}
        />
        <div className="game-vignette" />

        <AnimatePresence mode="wait">
          {isShopOpen && (
            <div key="shop-overlay" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsShopOpen(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-xl"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-[#050510] border border-white/10 rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
              >
                {/* Header */}
                <div className="p-8 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
                  <div className="flex items-center gap-6">
                    <motion.button
                      whileHover={{ scale: 1.1, x: -5 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        setIsShopOpen(false);
                        resetGame('START');
                      }}
                      className="bg-white/5 p-3 rounded-none border-b-4 border-r-4 border-white/20 text-white/60 hover:text-white"
                      title="Back to Home"
                    >
                      <RotateCcw className="w-6 h-6 rotate-180" />
                    </motion.button>
                    <div>
                      <h2 className="text-3xl font-retro text-white flex items-center gap-4">
                        SHOP <Sparkles className="text-yellow-400 w-8 h-8" />
                      </h2>
                      <p className="text-indigo-400 font-terminal text-lg tracking-widest uppercase mt-1">UPGRADE_PROTOCOL_v2.1</p>
                    </div>
                  </div>
                  <div className="bg-black px-6 py-4 rounded-none flex items-center gap-4 border-2 border-white/10">
                    <Zap className="w-6 h-6 text-yellow-400" />
                    <div>
                      <p className="text-[10px] text-white/40 uppercase font-retro">ESSENCE</p>
                      <p className="text-2xl font-retro text-white tabular-nums">{totalCoins}</p>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
                  <div className="space-y-12">
                    {/* Characters Section */}
                    <section>
                      <h3 className="text-sm font-retro text-indigo-400 mb-6 flex items-center gap-4 border-b border-white/10 pb-2 uppercase tracking-tighter">
                        <Dna className="w-5 h-5 text-purple-400" /> DREAM_FORMS
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {CHARACTERS.map(char => {
                          const isUnlocked = unlockedCharacters.includes(char.id);
                          const isSelected = selectedCharacterId === char.id;
                          return (
                            <motion.div 
                              key={char.id}
                              whileHover={{ 
                                scale: 1.02, 
                                translateY: -5,
                                boxShadow: isSelected ? "0 10px 20px rgba(79, 70, 229, 0.2)" : "0 10px 20px rgba(0, 0, 0, 0.3)"
                              }}
                              className={`relative p-8 rounded-none border-2 transition-all duration-300 ${
                                isSelected ? 'border-indigo-500 bg-indigo-900/20' : 'border-white/10 bg-black'
                              } group`}
                            >
                              <div className="flex justify-between items-start mb-6">
                                <div className="w-24 h-24 bg-white/5 border-2 border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                   <CharacterPreview char={char} size={100} />
                                </div>
                                {char.id === 7 && (
                                  <div className="px-2 py-0.5 bg-yellow-500 border border-yellow-700 text-[7px] font-retro text-black uppercase tracking-tighter">APEX_FORM</div>
                                )}
                                {!isUnlocked && <Lock className="w-5 h-5 text-white/20" />}
                              </div>
                              <h4 className="text-xl font-retro text-white mb-2 uppercase tracking-tighter">{char.name}</h4>
                              <p className="text-lg font-terminal text-white/40 mb-4 leading-snug h-12 uppercase">{char.description}</p>
                              
                              {/* Special Ability Display */}
                              {char.specialAbility && (
                                <div className="mb-6 p-4 border-2 border-indigo-900/40 bg-indigo-600/5 flex items-start gap-3 group/ability">
                                  <Sparkles className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0 group-hover/ability:animate-pulse" />
                                  <div>
                                    <p className="text-[8px] font-retro text-cyan-400 uppercase tracking-tighter mb-1">ABILITY</p>
                                    <p className="text-lg font-terminal text-white/80 leading-tight uppercase">{char.specialAbility}</p>
                                  </div>
                                </div>
                              )}
                              
                              <div className="flex flex-wrap gap-2 mb-8">
                                {char.traits?.map((trait, i) => (
                                  <span key={i} className="px-2 py-1 bg-white/5 border border-white/10 text-[7px] uppercase font-retro text-white/30 group-hover:text-white/60 transition-colors">
                                    {trait}
                                  </span>
                                ))}
                              </div>
                              
                              <div className="space-y-2">
                                {isUnlocked ? (
                                  <button
                                    onClick={() => {
                                      playProceduralSound('click', isMuted);
                                      setSelectedCharacterId(char.id);
                                    }}
                                    disabled={isSelected}
                                    className={`w-full py-4 font-retro text-[10px] transition-all border-b-4 border-r-4 ${
                                      isSelected ? 'bg-indigo-600 border-indigo-900 text-white' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                                    }`}
                                  >
                                    {isSelected ? 'PROTOCOL_ACTIVE' : 'ACTIVATE_LINK'}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      playProceduralSound('click', isMuted);
                                      if (totalCoins >= char.price) {
                                        setTotalCoins(prev => prev - char.price);
                                        setUnlockedCharacters(prev => [...prev, char.id]);
                                        if (char.id === 7) {
                                          setUpgradeLevels({
                                            health: 10,
                                            energy: 10,
                                            damage: 5
                                          });
                                        }
                                      }
                                    }}
                                    disabled={totalCoins < char.price}
                                    className={`w-full py-4 font-retro text-[10px] transition-all border-b-4 border-r-4 ${
                                      totalCoins >= char.price ? 'bg-white text-black border-slate-300 hover:bg-yellow-500 hover:text-white hover:border-yellow-900' : 'bg-white/5 border-white/5 text-white/10 cursor-not-allowed'
                                    }`}
                                  >
                                    <Zap className="w-4 h-4 mr-2 inline" />
                                    {char.price.toLocaleString()}
                                  </button>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </section>

                    {/* Upgrades Section */}
                    <section>
                      <h3 className="text-sm font-retro text-cyan-400 mb-6 flex items-center gap-4 border-b border-white/10 pb-2 uppercase tracking-tighter">
                        <Zap className="w-5 h-5 text-cyan-400" /> VOID_ENHANCEMENTS
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {UPGRADES.map(up => {
                          const currentLvl = upgradeLevels[up.id] || 0;
                          const isMax = currentLvl >= up.maxLevel;
                          return (
                            <motion.div 
                              key={up.id} 
                              whileHover={{ 
                                scale: 1.02,
                                borderColor: 'rgba(6, 182, 212, 0.4)',
                                backgroundColor: 'rgba(0, 0, 0, 1)'
                              }}
                              className="relative p-8 rounded-none border-2 border-white/10 bg-black group"
                            >
                              <div className="absolute -top-3 -right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-cyan-500 text-[7px] font-retro px-3 py-1 text-black shadow-lg z-10 uppercase">
                                {up.id === 'health' ? '+20 HP EACH' : up.id === 'energy' ? '+20 BATT EACH' : 'BOLT DENSITY'}
                              </div>
                              <div className="w-14 h-14 rounded-none bg-white/5 border-2 border-white/10 flex items-center justify-center mb-6 transition-colors group-hover:border-cyan-400">
                                {up.id === 'health' ? <Heart className="w-8 h-8 text-red-400" /> : <Zap className="w-8 h-8 text-cyan-400" />}
                              </div>
                              <h4 className="text-xl font-retro text-white mb-2 uppercase tracking-tighter">{up.name}</h4>
                              <p className="text-lg font-terminal text-white/40 mb-8 leading-snug h-12 uppercase">{up.description}</p>
                              
                              <div className="flex gap-2 mb-6">
                                {Array.from({ length: up.maxLevel }).map((_, i) => (
                                  <div key={i} className={`h-2 flex-1 border border-white/10 ${i < currentLvl ? 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]' : 'bg-transparent'}`} />
                                ))}
                              </div>

                              <button
                                onClick={() => {
                                  playProceduralSound('click', isMuted);
                                  const price = getUpgradePrice(up, currentLvl);
                                  if (!isMax && totalCoins >= price) {
                                    setTotalCoins(prev => prev - price);
                                    setUpgradeLevels(prev => ({ ...prev, [up.id]: (prev[up.id] || 0) + 1 }));
                                  }
                                }}
                                disabled={isMax || totalCoins < getUpgradePrice(up, currentLvl)}
                                className={`w-full py-4 font-retro text-[10px] transition-all border-b-4 border-r-4 ${
                                  isMax ? 'bg-cyan-500/10 text-cyan-500/30 border-cyan-900/20 cursor-not-allowed' : (totalCoins >= getUpgradePrice(up, currentLvl) ? 'bg-white text-black border-slate-300 hover:bg-cyan-500 hover:text-white hover:border-cyan-900 active:translate-y-1' : 'bg-white/5 border-white/5 text-white/10 cursor-not-allowed')
                                }`}
                              >
                                {isMax ? 'PEAK_EVOLUTION' : <><Zap className="w-4 h-4 mr-2 inline" /> {getUpgradePrice(up, currentLvl).toLocaleString()}</>}
                              </button>
                            </motion.div>
                          );
                        })}
                      </div>
                    </section>
                  </div>
                </div>

                {/* Footer Tips */}
                <div className="p-10 bg-black border-t-4 border-indigo-600 flex flex-wrap justify-center gap-16 text-[9px] text-white/40 font-retro uppercase tracking-widest">
                  <div className="flex items-center gap-4 group transition-colors hover:text-indigo-400">
                    <Sparkles className="w-4 h-4 text-indigo-400" /> 
                    <span>SYNC_LAUNCH_STATS</span>
                  </div>
                  <div className="flex items-center gap-4 group transition-colors hover:text-indigo-400">
                    <ArrowDown className="w-4 h-4 text-indigo-400" /> 
                    <span>MEMORY_SYNC:ON</span>
                  </div>
                  <div className="flex items-center gap-4 group transition-colors hover:text-indigo-400">
                    <Info className="w-4 h-4 text-indigo-400" /> 
                    <span>PAUSE_ACCESS:ENABLED</span>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* HUD */}
        <div className="absolute top-6 left-6 right-6 flex justify-between items-start pointer-events-none">
          <div className="flex gap-8">
            <div className="space-y-1 bg-black p-4 rounded-none border-2 border-white/20 shadow-2xl">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-[8px] uppercase font-retro text-white/40 mb-1">SCORE</p>
                  <p className="text-3xl font-retro text-orange-500 tabular-nums">{score}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 pt-2">
                <div className="flex flex-col gap-1">
                  <p className="text-[8px] uppercase font-retro text-white/40">VITALITY</p>
                  <div 
                    className="h-4 bg-white/10 rounded-none border border-white/20"
                    style={{ width: `${healthBarWidth}px` }}
                  >
                    <motion.div 
                      initial={{ width: '100%' }}
                      animate={{ width: `${(health / maxH) * 100}%` }}
                      className={`h-full ${
                        health / maxH > 0.5 ? 'bg-green-500' : health / maxH > 0.25 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[8px] uppercase font-retro text-cyan-400">RESONANCE</p>
                  <div 
                    className="h-4 bg-white/10 rounded-none border border-white/20"
                    style={{ width: `${energyBarWidth}px` }}
                  >
                    <motion.div 
                      animate={{ width: `${((playerRef.current?.energy || 0) / maxE) * 100}%` }}
                      className="h-full bg-cyan-500"
                    />
                  </div>
                </div>
                {/* Skill UI */}
                {selectedChar.id >= 4 && (
                  <div className="flex flex-col gap-1 ml-2 items-center">
                    <p className="text-[8px] uppercase tracking-[0.2em] text-indigo-400 font-mono font-bold">Skill</p>
                    <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center relative overflow-hidden">
                      {playerRef.current.skillCooldown > 0 ? (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-[10px] font-bold text-white/40 font-mono">
                          {Math.ceil(playerRef.current.skillCooldown / 60)}
                        </div>
                      ) : (
                        <Zap className={`w-4 h-4 ${playerRef.current.skillActive > 0 ? 'text-white animate-pulse' : 'text-slate-500'}`} />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Deep Sleep Indicator */}
          <AnimatePresence>
            {isDeepSleep && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-purple-900/40 backdrop-blur-md px-8 py-3 rounded-full shadow-[0_0_30px_rgba(168,85,247,0.3)] border border-purple-500/50 flex items-center gap-4 pointer-events-none"
              >
                <Moon className="w-4 h-4 text-purple-400 animate-pulse" />
                <span className="text-xs font-black tracking-[0.3em] text-white">DEEP SLEEP</span>
                <div className="h-4 w-[1px] bg-white/20" />
                <span className="text-xs font-bold text-yellow-400 tracking-wider">3X SOULS</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-4 pointer-events-auto items-center">
            <AnimatePresence>
              {audioStatus === 'locked' && !isMuted && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.1, backgroundColor: 'rgba(234, 179, 8, 0.4)' }}
                  onClick={async () => {
                    await AudioController.resume();
                    setAudioStatus('unlocked');
                  }}
                  className="px-6 py-3 bg-yellow-500/30 backdrop-blur-md rounded-2xl border border-yellow-500/50 text-yellow-200 text-[10px] font-black tracking-widest flex items-center gap-2 shadow-[0_0_20px_rgba(234,179,8,0.2)]"
                >
                  <Volume2 className="w-4 h-4" /> FIX AUDIO
                </motion.button>
              )}
            </AnimatePresence>

            <motion.button
              whileHover={{ scale: 1.1, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleMute}
              className="p-4 bg-black/40 backdrop-blur-md rounded-[20px] border border-white/10 shadow-xl text-white/50 hover:text-white transition-colors"
            >
              {isMuted ? <VolumeX className="w-5 h-5 text-red-500" /> : <Volume2 className="w-5 h-5 text-cyan-400" />}
            </motion.button>

            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.1, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setGameState('START')}
                className="p-3 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl text-white/50 hover:text-white transition-colors flex items-center justify-center"
                title="Go to Home"
              >
                <Home className="w-5 h-5" />
              </motion.button>

              <div className="text-right space-y-2 bg-black p-3 rounded-none border-2 border-white/20 shadow-2xl">
                <div>
                  <p className="text-[8px] uppercase font-retro text-white/40 mb-1">RECORD</p>
                  <p className="text-xl font-retro text-white/80 tabular-nums">{highScore}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Overlays */}
        <div className="crt-overlay crt-flicker" />
        <AnimatePresence mode="wait">
          {gameState === 'START' && (
            <motion.div
              key="start-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-start py-24 px-4 overflow-y-auto z-50 text-white"
            >
              <div className="w-full max-w-4xl space-y-12">
                <div className="text-center space-y-4">
                  <motion.div
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="w-20 h-20 bg-indigo-600 rounded-[24px] mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-8"
                  >
                    <Star className="w-10 h-10 text-white fill-current" />
                  </motion.div>

                  <motion.h1
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="text-4xl md:text-6xl font-retro tracking-tighter text-white drop-shadow-[0_4px_0_rgba(79,70,229,1)]"
                  >
                    DREAMY POUNCE
                  </motion.h1>
                  <p className="text-indigo-400 font-terminal tracking-[0.2em] uppercase text-lg font-bold">ARCADE EDITION v8.0</p>
                </div>

                <div className="flex flex-col sm:flex-row justify-center items-center gap-8">
                  <motion.button
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      playProceduralSound('click', isMuted);
                      resetGame();
                    }}
                    className="group relative px-12 py-5 bg-indigo-600 rounded-none border-b-4 border-r-4 border-indigo-900 font-retro text-sm transition-all flex items-center gap-4 text-white hover:bg-indigo-500"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    <span>INSERT_COIN</span>
                  </motion.button>
                  
                  <motion.button
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      playProceduralSound('click', isMuted);
                      setIsShopOpen(true);
                    }}
                    className="px-12 py-5 bg-white/10 border-b-4 border-r-4 border-white/20 rounded-none font-retro text-sm flex items-center gap-4 text-white hover:bg-white/20"
                  >
                    <ShoppingBag className="w-5 h-5" />
                    <span>SHOP</span>
                  </motion.button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-black border-2 border-indigo-500 p-8 rounded-none space-y-6">
                     <h3 className="text-sm font-retro text-indigo-400 uppercase flex items-center gap-4">
                       <Zap className="w-4 h-4" /> [SYSTEM_LOG]
                     </h3>
                     <div className="space-y-6 font-terminal text-lg">
                       <div className="flex items-start gap-4">
                         <Star className="text-yellow-400 w-6 h-6 shrink-0" />
                         <p className="leading-relaxed text-white/80">ANCIENT STARS detected. Restoration: +25HP.</p>
                       </div>
                        <div className="flex items-start gap-4">
                          <Shield className="text-cyan-400 w-6 h-6 shrink-0" />
                          <p className="leading-relaxed text-white/80">DREAM AEGIS multilayering initialized.</p>
                        </div>
                     </div>
                  </div>

                  <div className="bg-black border-2 border-white/10 p-8 rounded-none flex flex-col justify-center items-center gap-4 text-center">
                    <p className="text-xs text-white/40 uppercase font-retro">ESSENCE</p>
                    <div className="flex items-center gap-6">
                      <Zap className="w-10 h-10 text-yellow-400" />
                      <p className="text-6xl font-retro text-white tabular-nums tracking-tighter">{totalCoins}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pt-16 border-t border-white/10">
                  {/* Category 1 */}
                  <div className="space-y-6">
                    <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest border-b border-white/10 pb-4">Entities</h3>
                    <div className="space-y-5 text-[10px] text-white/40 font-mono font-bold uppercase tracking-wider">
                      <div className="flex items-center gap-4 text-white/60">
                        <div className="w-1 h-1 rounded-full bg-red-400" />
                        <p>Nightmare Orbs</p>
                      </div>
                      <div className="flex items-center gap-4 text-white/60">
                        <div className="w-1 h-1 rounded-full bg-yellow-400" />
                        <p>Sleep Alarms</p>
                      </div>
                      <div className="flex items-center gap-4 text-white/60">
                        <div className="w-1 h-1 rounded-full bg-purple-400" />
                        <p>Yarn Rollers</p>
                      </div>
                    </div>
                  </div>

                  {/* Category 2 */}
                  <div className="space-y-6">
                    <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest border-b border-white/10 pb-4">Airborne</h3>
                    <div className="space-y-5 text-[10px] text-white/40 font-mono font-bold uppercase tracking-wider">
                      <div className="flex items-center gap-4 text-white/60">
                        <div className="w-1 h-1 rounded-full bg-indigo-400" />
                        <p>Dream Bats</p>
                      </div>
                      <div className="flex items-center gap-4 text-white/60">
                        <div className="w-1 h-1 rounded-full bg-slate-300" />
                        <p>Wraith Clouds</p>
                      </div>
                    </div>
                  </div>

                  {/* Category 3 */}
                  <div className="space-y-6">
                    <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest border-b border-white/10 pb-4">Augments</h3>
                    <div className="space-y-5 text-[10px] text-white/40 font-mono font-bold uppercase tracking-wider">
                      <div className="flex items-center gap-4 text-white/60">
                        <div className="w-1 h-1 rounded-full bg-yellow-400" />
                        <p>Health Stars</p>
                      </div>
                      <div className="flex items-center gap-4 text-white/60">
                        <div className="w-1 h-1 rounded-full bg-cyan-400" />
                        <p>Dream Shields</p>
                      </div>
                    </div>
                  </div>

                  {/* Category 4 */}
                  <div className="space-y-6">
                    <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest border-b border-white/10 pb-4">Options</h3>
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-white/40 font-mono font-bold uppercase tracking-wider">Mute Audio</label>
                      <button onClick={() => setIsMuted(!isMuted)} className={`w-10 h-5 rounded-full transition-colors flex items-center px-1 ${isMuted ? 'bg-red-500' : 'bg-white/10'}`}>
                        <div className={`w-3 h-3 bg-white rounded-full transition-transform ${isMuted ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {gameState === 'TUTORIAL' && tutorialInfo && (
            <motion.div
              key="tutorial-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 flex items-center justify-center p-4 z-[100]"
            >
              {/* Pointing Arrow */}
              <motion.div 
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute pointer-events-none"
                style={{
                  left: `${(tutorialInfo.x / CANVAS_WIDTH) * 100}%`,
                  top: `${(tutorialInfo.y / CANVAS_HEIGHT) * 100}%`,
                  transform: 'translate(-50%, -150%)'
                }}
              >
                <div className="flex flex-col items-center gap-2">
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 1, ease: "easeInOut" }}
                    className="p-2 bg-indigo-600 border-2 border-white/20 shadow-2xl"
                  >
                    <ArrowDown className="w-8 h-8 text-white" />
                  </motion.div>
                </div>
              </motion.div>

              <motion.div
                initial={{ scale: 0.9, y: 30 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-black border-4 border-indigo-600 p-6 max-w-[280px] text-center space-y-6 shadow-2xl"
              >
                <div className="space-y-2">
                  <p className="text-indigo-400 font-retro text-[8px] uppercase tracking-widest">MISSION_INTEL</p>
                  <h3 className="text-xl font-retro text-white uppercase leading-none">
                    {tutorialInfo.title}
                  </h3>
                  <div className="h-1 bg-white/10 w-12 mx-auto mt-4" />
                </div>
                
                <p className="text-white/80 font-terminal text-lg leading-snug">
                  {tutorialInfo.description}
                </p>
                
                <button
                  onClick={() => {
                    playProceduralSound('click', isMuted);
                    setGameState('PLAYING');
                    if (pendingIntroductionsRef.current.length === 0) {
                      setHasSeenTutorial(true);
                    }
                  }}
                  className="w-full py-4 bg-indigo-600 border-b-4 border-r-4 border-indigo-900 font-retro text-[10px] text-white hover:bg-indigo-500 uppercase"
                >
                  ACKNOWLEDGE
                </button>
              </motion.div>
            </motion.div>
          )}

          {gameState === 'PAUSED' && (
            <motion.div
              key="paused-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center z-[200] p-8"
            >
              <div className="bg-black border-4 border-indigo-600 p-12 max-w-sm w-full text-center space-y-10">
                <div className="space-y-4">
                  <h2 className="text-4xl font-retro text-white tracking-tighter">PAUSED</h2>
                  <div className="h-1 bg-indigo-500/30 w-1/2 mx-auto" />
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <button
                    onClick={() => {
                      playProceduralSound('click', isMuted);
                      setGameState('PLAYING');
                    }}
                    className="group relative px-6 py-4 bg-indigo-600 border-b-4 border-r-4 border-indigo-900 font-retro text-xs text-white hover:bg-indigo-500 flex items-center justify-center gap-4"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>RESUME_VOYAGE</span>
                  </button>

                  <button
                    onClick={() => {
                      playProceduralSound('click', isMuted);
                      setIsShopOpen(true);
                      setGameState('PAUSED'); // Stay in pause state logically but shop covers it
                    }}
                    className="group relative px-6 py-4 bg-white/5 border-b-4 border-r-4 border-white/20 font-retro text-xs text-white hover:bg-white/10 flex items-center justify-center gap-4"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>OPEN_SHOP</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      playProceduralSound('click', isMuted);
                      resetGame('START');
                    }}
                    className="px-6 py-3 bg-red-500/10 border-b-4 border-r-4 border-red-500/20 font-retro text-[8px] text-red-400 hover:bg-red-500/20 flex items-center justify-center gap-4"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>ABORT_MISSION</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {gameState === 'GAMEOVER' && (
            <motion.div
              key="gameover-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-red-950/90 backdrop-blur-xl flex flex-col items-center justify-start overflow-y-auto pt-16 pb-20 text-center p-8 text-white"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="space-y-8 w-full max-w-sm bg-black border-4 border-red-600 p-10 rounded-none"
              >
                <div className="space-y-4">
                  <h2 className="text-4xl font-retro text-red-500">GAMEOVER</h2>
                  <p className="text-white/40 font-terminal text-xl uppercase">DREAM_CORRUPTED</p>
                </div>

                <div className="bg-white/5 border-2 border-white/10 p-6 rounded-none space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-white/40 font-terminal text-lg uppercase tracking-widest">FINAL_SCORE</span>
                    <span className="text-2xl font-retro text-red-500">{score}</span>
                  </div>
                  <div className="h-0.5 bg-white/10" />
                  <div className="flex justify-between items-center">
                    <span className="text-white/40 font-terminal text-lg uppercase tracking-widest">RECORD_HIGH</span>
                    <span className="text-xl font-retro text-white/60">{highScore}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      playProceduralSound('click', isMuted);
                      setHasSeenTutorial(true); 
                      resetGame();
                    }}
                    className="px-12 py-5 bg-indigo-600 border-b-4 border-r-4 border-indigo-900 font-retro text-xs transition-all flex items-center justify-center gap-4 text-white hover:bg-indigo-500 w-full"
                  >
                    <RotateCcw className="w-5 h-5" />
                    INSERT_COIN_TO_RETRY
                  </button>
                  <button
                    onClick={() => {
                      playProceduralSound('click', isMuted);
                      setHasSeenTutorial(true);
                      resetGame('START');
                    }}
                    className="px-12 py-4 bg-white/10 text-white/60 hover:bg-white/20 rounded-none font-retro text-[10px] transition-all border-2 border-white/10 w-full"
                  >
                    RETURN_TO_BASE
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {gameState === 'WIN' && (
            <motion.div
              key="win-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-start overflow-y-auto pt-16 pb-20 text-center p-8 text-white"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="space-y-8 w-full max-w-sm bg-black border-4 border-yellow-500 p-10 rounded-none"
              >
                <div className="space-y-4">
                  <div className="flex justify-center mb-4">
                    <Trophy className="w-16 h-16 text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,0.5)]" />
                  </div>
                  <h2 className="text-4xl font-retro text-yellow-400">VICTORY</h2>
                  <p className="text-white/60 font-terminal text-xl uppercase">DIMENSION_TRANSCENDED</p>
                </div>

                <div className="bg-white/5 border-2 border-white/10 p-6 rounded-none space-y-4 shadow-2xl">
                  <div className="flex justify-between items-center">
                    <span className="text-white/40 font-terminal text-lg uppercase tracking-widest">FINAL_ESSENCE</span>
                    <span className="text-3xl font-retro text-yellow-400 tabular-nums">{score}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      playProceduralSound('click', isMuted);
                      setHasSeenTutorial(true);
                      const options: World[] = ['COSMIC', 'LAVA', 'AQUATIC'];
                      setWorldOptions(options.filter(o => o !== currentWorld).sort(() => Math.random() - 0.5).slice(0, 2));
                      setIsWorldTransitioning(true);
                    }}
                    className="px-12 py-5 bg-yellow-500 border-b-4 border-r-4 border-yellow-700 font-retro text-xs transition-all flex items-center justify-center gap-4 text-black hover:bg-yellow-400 w-full shadow-2xl"
                  >
                    <Trophy className="w-5 h-5" />
                    TRANSCEND_REALM
                  </button>
                  <button
                    onClick={() => {
                      playProceduralSound('click', isMuted);
                      setHasSeenTutorial(true);
                      resetGame('START');
                    }}
                    className="px-12 py-4 bg-white/10 text-white/60 hover:bg-white/20 rounded-none font-retro text-[10px] transition-all border-2 border-white/10 w-full"
                  >
                    RETURN_TO_HOME
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {isWorldTransitioning && (
            <motion.div
              key="world-branching-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl"
            >
              <div className="max-w-4xl w-full">
                <div className="text-center mb-16">
                  <motion.h2 initial={{ y: -20 }} animate={{ y: 0 }} className="text-5xl md:text-7xl font-retro text-white mb-6 uppercase tracking-tighter">SELECT PATH</motion.h2>
                  <p className="text-indigo-400 font-terminal text-xl tracking-[0.3em] uppercase font-bold">DIMENSIONAL_ALIGNMENT_REQUIRED</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  {worldOptions.map((w, idx) => (
                    <motion.button
                      key={`world-choice-${w}-${idx}`}
                      whileHover={{ scale: 1.02, translateY: -10 }}
                      whileTap={{ scale: 0.98 }}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.15 }}
                      onClick={() => {
                        setIsWorldTransitioning(false);
                        resetGame('PLAYING', w);
                      }}
                      className="group relative h-96 rounded-none border-b-8 border-r-8 border-white/10 hover:border-indigo-500 transition-all bg-black flex flex-col items-center justify-center"
                    >
                       <div className={`absolute inset-0 opacity-20 group-hover:opacity-40 transition-opacity bg-gradient-to-br ${
                         w === 'COSMIC' ? 'from-indigo-600 to-cyan-500' :
                         w === 'LAVA' ? 'from-orange-600 to-red-600' :
                         w === 'AQUATIC' ? 'from-blue-600 to-cyan-400' :
                         'from-emerald-600 to-teal-500'
                       }`} />
                       <div className="relative z-10 flex flex-col items-center gap-8 px-8">
                         <div className={`p-8 rounded-none border-4 border-white/20 shadow-xl transform transition-transform group-hover:rotate-12 ${
                            w === 'COSMIC' ? 'bg-indigo-900 text-indigo-400' :
                            w === 'LAVA' ? 'bg-red-900 text-red-400' :
                            w === 'AQUATIC' ? 'bg-blue-900 text-blue-400' :
                            'bg-emerald-900 text-emerald-400'
                         }`}>
                           {w === 'COSMIC' ? <Moon className="w-16 h-16" /> : 
                            w === 'LAVA' ? <Flame className="w-16 h-16" /> : 
                            w === 'AQUATIC' ? <Waves className="w-16 h-16" /> :
                            <Wind className="w-16 h-16" />}
                         </div>
                         <div className="text-center">
                           <h3 className="text-4xl font-retro text-white mb-4 tracking-tighter uppercase">{w}</h3>
                           <p className="text-white/40 font-terminal text-xl uppercase tracking-widest">
                             {w === 'COSMIC' ? 'STARDUST_&_SILENCE' : 
                              w === 'LAVA' ? 'CINDER_&_CORE' : 
                              w === 'AQUATIC' ? 'ABYSSAL_CURRENT' :
                              'LEGACY_MISSION'}
                           </p>
                         </div>
                       </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quiz Overlay */}
        <AnimatePresence>
          {gameState === 'PLAYING' && (
            <>
              {/* Mobile Gamepad: Actions (Left) */}
              <div className="absolute bottom-10 left-10 flex gap-6 pointer-events-auto z-[60]">
                <motion.button
                  whileTap={{ scale: 0.9, y: 4 }}
                  onPointerDown={() => handleKeyDown({ code: 'VirtualQ', preventDefault: () => {} })}
                  className="w-24 h-24 bg-red-600 border-b-8 border-r-8 border-red-900 rounded-none flex flex-col items-center justify-center text-white font-retro shadow-2xl"
                >
                  <Zap className="w-8 h-8 fill-current mb-2" />
                  <span className="text-[8px] uppercase">SKILL</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.9, y: 4 }}
                  onPointerDown={() => handleKeyDown({ code: 'VirtualX', preventDefault: () => {} })}
                  className="w-24 h-24 bg-blue-600 border-b-8 border-r-8 border-blue-900 rounded-none flex flex-col items-center justify-center text-white font-retro shadow-2xl"
                >
                  <Crosshair className="w-8 h-8 mb-2" />
                  <span className="text-[8px] uppercase">FIRE</span>
                </motion.button>
              </div>

              {/* Mobile Gamepad: Movement (Right) */}
              <div className="absolute bottom-10 right-10 grid grid-cols-2 gap-4 pointer-events-auto z-[60]">
                <motion.button
                  whileTap={{ scale: 0.9, y: 4 }}
                  onPointerDown={() => handleKeyDown({ code: 'VirtualUp', preventDefault: () => {} })}
                  onPointerUp={() => handleKeyUp({ code: 'VirtualUp' })}
                  className="w-24 h-24 bg-white/20 border-b-8 border-r-8 border-white/10 rounded-none flex flex-col items-center justify-center text-white font-retro"
                >
                  <ArrowUp className="w-10 h-10" />
                  <span className="text-[8px] mt-1">JUMP</span>
                </motion.button>
              </div>
            </>
          )}

          {quizState.active && quizState.question && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 flex items-center justify-center z-[200] p-6"
            >
              <motion.div
                initial={{ scale: 0.8, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-black border-4 border-indigo-600 p-12 w-full max-w-md text-center space-y-10 shadow-2xl"
              >
               <div className="space-y-4">
  <h3 className="text-3xl font-retro text-white uppercase tracking-tighter">DREAM_PARADOX</h3>
  <p className="text-yellow-400 font-terminal text-xl uppercase tracking-widest">+700_ESSENCE_AT_STAKE</p>
</div>

{/* Corrected block below */}
<div className="bg-white/5 p-8 border-2 border-white/10">
  <p className="text-xl font-terminal text-white leading-relaxed italic">
    "{quizState.question.text}"
  </p>
</div> <div className="flex justify-center">
                  <div className="bg-indigo-600 p-6 border-b-4 border-r-4 border-indigo-900 shadow-xl">
                    <Brain className="w-10 h-10 text-white" />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-3xl font-retro text-white uppercase tracking-tighter">DREAM_PARADOX</h3>
                  <p className="text-yellow-400 font-terminal text-xl uppercase tracking-widest">+700_ESSENCE_AT_STAKE</p>
                </div>
 className="bg-white/5 p-8 border-2 border-white/10">
                  <
                <divp className="text-xl font-terminal text-white leading-relaxed italic">"{quizState.question.text}"</p>
                </div>

                <div className="grid grid-cols-1 gap-6 text-left">
                  {quizState.question.options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => handleQuizAnswer(i === quizState.question?.correctAnswer)}
                      className="w-full py-5 px-6 bg-black border-2 border-white/10 hover:border-indigo-600 font-terminal text-lg text-white hover:bg-indigo-900/40 transition-all flex items-center justify-between group"
                    >
                      <span className="font-bold">{opt}</span>
                      <div className="w-10 h-10 bg-white/10 border-2 border-white/10 group-hover:border-indigo-600 flex items-center justify-center font-retro text-[10px] text-white group-hover:text-indigo-400 transition-colors">
                        {String.fromCharCode(65 + i)}
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
