// SPDX-License-Identifier: BSD-3-Clause OR Apache-2.0
//
// Copyright (c) 2026 Witt Kung <witt.w.kung@gmail.com>
// All rights reserved.

use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use tokio::time::{sleep, Duration};

/// AIMD (Additive Increase / Multiplicative Decrease) 自适应流控器
#[derive(Clone)]
pub struct AdaptiveRateLimiter {
    current_qps: Arc<AtomicU32>,
    consecutive_successes: Arc<AtomicU32>,
}

impl AdaptiveRateLimiter {
    pub fn new(initial_qps: u32) -> Self {
        Self {
            current_qps: Arc::new(AtomicU32::new(initial_qps.max(1))),
            consecutive_successes: Arc::new(AtomicU32::new(0)),
        }
    }

    /// 请求执行前获取令牌 (平滑延迟)
    pub async fn acquire(&self) {
        let qps = self.current_qps.load(Ordering::Relaxed).max(1);
        let interval_micros = 1_000_000 / qps as u64;
        sleep(Duration::from_micros(interval_micros)).await;
    }

    /// 成功响应：加法递增 (Additive Increase)
    pub fn on_success(&self) {
        let succ = self.consecutive_successes.fetch_add(1, Ordering::Relaxed);
        if succ >= 10 {
            self.consecutive_successes.store(0, Ordering::Relaxed);
            let prev = self.current_qps.load(Ordering::Relaxed);
            if prev < 50 {
                self.current_qps.store(prev + 1, Ordering::Relaxed);
            }
        }
    }

    /// 遇到 429 速率限制：乘法骤降 (Multiplicative Decrease)
    pub fn on_rate_limited(&self) {
        self.consecutive_successes.store(0, Ordering::Relaxed);
        let prev = self.current_qps.load(Ordering::Relaxed);
        let new_qps = (prev / 2).max(1);
        self.current_qps.store(new_qps, Ordering::Relaxed);
    }
}
