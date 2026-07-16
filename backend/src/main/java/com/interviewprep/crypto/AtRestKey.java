package com.interviewprep.crypto;

import javax.crypto.SecretKey;

public final class AtRestKey {

    private static volatile SecretKey key;

    private AtRestKey() {
    }

    public static void set(SecretKey k) {
        key = k;
    }

    public static SecretKey get() {
        SecretKey k = key;
        if (k == null) {
            throw new IllegalStateException("At-rest encryption key is not initialized");
        }
        return k;
    }
}
