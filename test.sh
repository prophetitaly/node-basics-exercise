#!/bin/bash
echo "🧪 TESTING API Node.js..."

BASE_URL="http://localhost:3000"
USER_ID=""

# Test 1: POST user (crea primo utente)

echo "1️⃣ POST /users..."
RESPONSE=$(curl -s -w "
%{http_code}" -X POST $BASE_URL/users  -H "Content-Type: application/json"  -d '{"name":"Mario Rossi","email":"mario@test.com"}')

BODY=$(echo $RESPONSE | head -n -1)
STATUS=$(echo $RESPONSE | tail -n1)

if [ "$STATUS" = "201" ]; then
USER_ID=$(echo $BODY | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "✅ POST OK - User ID: $USER_ID"
else
echo "❌ POST FAILED - Status: $STATUS"
exit 1
fi

# Test 2: GET /users (lista)

echo "2️⃣ GET /users..."
curl -s $BASE_URL/users | jq '.'

# Test 3: GET /users/:id (singolo)

echo "3️⃣ GET /users/$USER_ID..."
curl -s $BASE_URL/users/$USER_ID | jq '.'

# Test 4: GET inesistente (404)

echo "4️⃣ GET /users/999..."
STATUS=$(curl -s -w "%{http_code}" -o /dev/null $BASE_URL/users/999)
[ "$STATUS" = "404" ] && echo "✅ 404 OK" || echo "❌ 404 FAILED"

# Test 5: POST invalid (400)

echo "5️⃣ POST invalid..."
STATUS=$(curl -s -w "%{http_code}" -X POST -o /dev/null   -H "Content-Type: application/json"   -d '{"name":"a","email":"invalid"}' $BASE_URL/users)
[ "$STATUS" = "400" ] && echo "✅ 400 OK" || echo "❌ 400 FAILED"

# Test 6: DELETE user

echo "6️⃣ DELETE /users/$USER_ID..."
STATUS=$(curl -s -w "%{http_code}" -X DELETE $BASE_URL/users/$USER_ID)
[ "$STATUS" = "204" ] && echo "✅ DELETE OK" || echo "❌ DELETE FAILED"

echo "🎉 TEST COMPLETATI!"
