#!/usr/bin/env python3
"""
Backend API Testing for Life Simulator
Tests all endpoints with FREE AI (no LLM cost)
"""

import requests
import json
import sys
from typing import Dict, Any

# Base URL from environment
BASE_URL = "https://sims-ai-sandbox.preview.emergentagent.com/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def print_test(name: str, passed: bool, details: str = ""):
    status = f"{Colors.GREEN}✅ PASS{Colors.END}" if passed else f"{Colors.RED}❌ FAIL{Colors.END}"
    print(f"{status} - {name}")
    if details:
        print(f"  {Colors.BLUE}Details:{Colors.END} {details}")
    if not passed:
        print()

def test_health():
    """Test GET /api/health"""
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        data = response.json()
        
        passed = (
            response.status_code == 200 and
            data.get("status") == "healthy"
        )
        
        print_test(
            "GET /api/health - Health check",
            passed,
            f"Status: {data.get('status')}" if passed else f"Response: {data}"
        )
        return passed
    except Exception as e:
        print_test("GET /api/health - Health check", False, f"Error: {str(e)}")
        return False

def test_root():
    """Test GET /api/ - Should return FREE AI message"""
    try:
        response = requests.get(f"{BASE_URL}/", timeout=10)
        data = response.json()
        
        # Check for FREE AI message
        ai_info = data.get("ai", "")
        has_free_ai = "FREE" in str(ai_info).upper() or "no LLM" in str(ai_info).lower()
        
        passed = (
            response.status_code == 200 and
            "message" in data and
            has_free_ai
        )
        
        print_test(
            "GET /api/ - Root endpoint with FREE AI info",
            passed,
            f"Message: {data.get('message')}, AI: {data.get('ai')}" if passed else f"Response: {data}"
        )
        return passed
    except Exception as e:
        print_test("GET /api/ - Root endpoint", False, f"Error: {str(e)}")
        return False

def test_characters():
    """Test GET /api/characters - Should return 3 NPCs with full attributes"""
    try:
        response = requests.get(f"{BASE_URL}/characters", timeout=10)
        data = response.json()
        
        # Check we have 3 characters
        has_three = len(data) >= 3
        
        # Check for Sophie, Kenji, Marcus
        names = [char.get("name", "") for char in data]
        has_sophie = any("Sophie" in name for name in names)
        has_kenji = any("Kenji" in name for name in names)
        has_marcus = any("Marcus" in name for name in names)
        
        # Check first character has all required attributes
        if data:
            char = data[0]
            attributes = char.get("attributes", {})
            has_attributes = all(
                attr in attributes 
                for attr in ["intelligence", "strength", "charisma", "beauty", "creativity", "luck"]
            )
            has_personality = "personality" in char
            has_hobbies = "hobbies" in char
            has_objectives = "objectives" in char
        else:
            has_attributes = has_personality = has_hobbies = has_objectives = False
        
        passed = (
            response.status_code == 200 and
            has_three and
            has_sophie and has_kenji and has_marcus and
            has_attributes and has_personality and has_hobbies and has_objectives
        )
        
        details = f"Found {len(data)} characters: {', '.join(names[:3])}"
        if passed:
            details += f" | Attributes: ✓ | Personality: ✓ | Hobbies: ✓ | Objectives: ✓"
        
        print_test(
            "GET /api/characters - 3 NPCs with full attributes",
            passed,
            details
        )
        return passed
    except Exception as e:
        print_test("GET /api/characters", False, f"Error: {str(e)}")
        return False

def test_locations():
    """Test GET /api/locations - Should return 10 locations"""
    try:
        response = requests.get(f"{BASE_URL}/locations", timeout=10)
        data = response.json()
        
        # Check we have 10 locations
        has_ten = len(data) >= 10
        
        # Check for specific locations mentioned in review
        location_names = [loc.get("name", "").lower() for loc in data]
        has_paris_cafe = any("paris" in name or "parisien" in name for name in location_names)
        has_tokyo_apartment = any("tokyo" in name or "shibuya" in name for name in location_names)
        
        # Check structure
        if data:
            loc = data[0]
            has_structure = all(
                field in loc 
                for field in ["id", "name", "description", "type", "city", "country", "emoji", "available_actions"]
            )
        else:
            has_structure = False
        
        passed = (
            response.status_code == 200 and
            has_ten and
            has_paris_cafe and has_tokyo_apartment and
            has_structure
        )
        
        details = f"Found {len(data)} locations"
        if passed:
            details += f" | Paris cafe: ✓ | Tokyo apartment: ✓ | Structure: ✓"
        
        print_test(
            "GET /api/locations - 10 locations with proper structure",
            passed,
            details
        )
        return passed
    except Exception as e:
        print_test("GET /api/locations", False, f"Error: {str(e)}")
        return False

def test_translations_fr():
    """Test GET /api/translations/fr - French translations"""
    try:
        response = requests.get(f"{BASE_URL}/translations/fr", timeout=10)
        data = response.json()
        
        # Check for French translations
        has_french = (
            data.get("app_name") is not None and
            "intelligence" in data and
            "strength" in data and
            "charisma" in data and
            "beauty" in data and
            "creativity" in data and
            "luck" in data
        )
        
        # Check if translations are actually in French
        is_french = (
            data.get("strength") == "Force" or
            data.get("beauty") == "Beauté" or
            "Beauté" in str(data.values())
        )
        
        passed = (
            response.status_code == 200 and
            has_french and
            is_french
        )
        
        details = f"Attributes found: intelligence, strength, charisma, beauty, creativity, luck"
        if is_french:
            details += " | Language: French ✓"
        
        print_test(
            "GET /api/translations/fr - French translations with attributes",
            passed,
            details
        )
        return passed
    except Exception as e:
        print_test("GET /api/translations/fr", False, f"Error: {str(e)}")
        return False

def test_translations_en():
    """Test GET /api/translations/en - English translations"""
    try:
        response = requests.get(f"{BASE_URL}/translations/en", timeout=10)
        data = response.json()
        
        # Check for English translations
        has_english = (
            data.get("app_name") is not None and
            "intelligence" in data and
            "strength" in data and
            "charisma" in data and
            "beauty" in data and
            "creativity" in data and
            "luck" in data
        )
        
        # Check if translations are in English
        is_english = (
            data.get("strength") == "Strength" and
            data.get("beauty") == "Beauty"
        )
        
        passed = (
            response.status_code == 200 and
            has_english and
            is_english
        )
        
        details = f"Attributes found: intelligence, strength, charisma, beauty, creativity, luck"
        if is_english:
            details += " | Language: English ✓"
        
        print_test(
            "GET /api/translations/en - English translations with attributes",
            passed,
            details
        )
        return passed
    except Exception as e:
        print_test("GET /api/translations/en", False, f"Error: {str(e)}")
        return False

def test_objectives():
    """Test GET /api/objectives - Life objectives list"""
    try:
        response = requests.get(f"{BASE_URL}/objectives", timeout=10)
        data = response.json()
        
        # Check it's a list with objectives
        is_list = isinstance(data, list)
        has_objectives = len(data) > 0 if is_list else False
        
        passed = (
            response.status_code == 200 and
            is_list and
            has_objectives
        )
        
        details = f"Found {len(data)} objectives" if is_list else f"Response: {data}"
        if passed and len(data) > 0:
            details += f" | Examples: {', '.join(data[:3])}"
        
        print_test(
            "GET /api/objectives - Life objectives list",
            passed,
            details
        )
        return passed
    except Exception as e:
        print_test("GET /api/objectives", False, f"Error: {str(e)}")
        return False

def test_hobbies():
    """Test GET /api/hobbies - Hobbies list"""
    try:
        response = requests.get(f"{BASE_URL}/hobbies", timeout=10)
        data = response.json()
        
        # Check it's a list with hobbies
        is_list = isinstance(data, list)
        has_hobbies = len(data) > 0 if is_list else False
        
        passed = (
            response.status_code == 200 and
            is_list and
            has_hobbies
        )
        
        details = f"Found {len(data)} hobbies" if is_list else f"Response: {data}"
        if passed and len(data) > 0:
            details += f" | Examples: {', '.join(data[:3])}"
        
        print_test(
            "GET /api/hobbies - Hobbies list",
            passed,
            details
        )
        return passed
    except Exception as e:
        print_test("GET /api/hobbies", False, f"Error: {str(e)}")
        return False

def test_simulate():
    """Test POST /api/simulate - FREE AI simulation (no LLM calls)"""
    try:
        response = requests.post(f"{BASE_URL}/simulate", timeout=15)
        data = response.json()
        
        # Check response structure
        has_status = data.get("status") == "success"
        has_results = "results" in data and isinstance(data["results"], list)
        
        # Check results have required fields
        if has_results and len(data["results"]) > 0:
            result = data["results"][0]
            has_fields = all(
                field in result 
                for field in ["character_id", "name", "action", "thought", "mood", "location"]
            )
            
            # Check thought is not empty (FREE AI should generate thoughts)
            has_thought = result.get("thought", "") != ""
        else:
            has_fields = has_thought = False
        
        passed = (
            response.status_code == 200 and
            has_status and
            has_results and
            has_fields and
            has_thought
        )
        
        details = f"Status: {data.get('status')}"
        if has_results:
            details += f" | Results: {len(data['results'])} characters"
            if has_thought:
                details += f" | Thoughts generated: ✓ (FREE AI working)"
        
        print_test(
            "POST /api/simulate - FREE AI simulation (no LLM)",
            passed,
            details
        )
        return passed
    except Exception as e:
        print_test("POST /api/simulate", False, f"Error: {str(e)}")
        return False

def test_stripe_prices():
    """Test GET /api/stripe/prices - Should return monthly and yearly pricing"""
    try:
        response = requests.get(f"{BASE_URL}/stripe/prices", timeout=10)
        data = response.json()
        
        # Check response structure
        has_prices = "prices" in data and isinstance(data["prices"], list)
        
        if has_prices:
            prices = data["prices"]
            # Find monthly and yearly plans
            monthly = next((p for p in prices if p.get("interval") == "month"), None)
            yearly = next((p for p in prices if p.get("interval") == "year"), None)
            
            has_monthly = monthly is not None and monthly.get("amount") == 4.99
            has_yearly = yearly is not None and yearly.get("amount") == 39.99
            
            # Check structure
            if monthly:
                has_structure = all(
                    field in monthly 
                    for field in ["id", "name", "amount", "currency", "interval"]
                )
            else:
                has_structure = False
        else:
            has_monthly = has_yearly = has_structure = False
        
        passed = (
            response.status_code == 200 and
            has_prices and
            has_monthly and
            has_yearly and
            has_structure
        )
        
        details = ""
        if has_monthly:
            details += f"Monthly: ${monthly['amount']} USD"
        if has_yearly:
            details += f" | Yearly: ${yearly['amount']} USD"
        if passed:
            details += " | Structure: ✓"
        
        print_test(
            "GET /api/stripe/prices - Stripe pricing",
            passed,
            details
        )
        return passed
    except Exception as e:
        print_test("GET /api/stripe/prices", False, f"Error: {str(e)}")
        return False

def test_stripe_subscription_status():
    """Test GET /api/stripe/subscription-status - Should return subscription status"""
    try:
        response = requests.get(f"{BASE_URL}/stripe/subscription-status", timeout=10)
        data = response.json()
        
        # Check response structure (without auth, should return default status)
        has_is_premium = "is_premium" in data
        has_subscription = "subscription" in data or "subscription_id" in data
        
        passed = (
            response.status_code == 200 and
            has_is_premium
        )
        
        details = f"is_premium: {data.get('is_premium')}"
        if "premium_until" in data:
            details += f" | premium_until: {data.get('premium_until')}"
        
        print_test(
            "GET /api/stripe/subscription-status - Subscription status",
            passed,
            details
        )
        return passed
    except Exception as e:
        print_test("GET /api/stripe/subscription-status", False, f"Error: {str(e)}")
        return False

def test_stripe_mock_subscribe_no_auth():
    """Test POST /api/stripe/mock-subscribe - Should return 401 without auth"""
    try:
        response = requests.post(f"{BASE_URL}/stripe/mock-subscribe", timeout=10)
        
        # Should return 401 Unauthorized without authentication
        passed = response.status_code == 401
        
        details = f"Status code: {response.status_code}"
        if passed:
            details += " | Auth required: ✓"
        else:
            details += f" | Expected 401, got {response.status_code}"
        
        print_test(
            "POST /api/stripe/mock-subscribe - Auth required (401)",
            passed,
            details
        )
        return passed
    except Exception as e:
        print_test("POST /api/stripe/mock-subscribe", False, f"Error: {str(e)}")
        return False

def test_move_character():
    """Test POST /api/characters/npc_sophie/move - Move Sophie to Sydney Beach"""
    try:
        response = requests.post(
            f"{BASE_URL}/characters/npc_sophie/move",
            params={"location_id": "sydney_beach"},
            timeout=10
        )
        data = response.json()
        
        # Check response
        has_success = data.get("status") == "success"
        correct_location = data.get("location") == "sydney_beach"
        
        passed = (
            response.status_code == 200 and
            has_success and
            correct_location
        )
        
        details = f"Status: {data.get('status')}, Location: {data.get('location')}"
        
        print_test(
            "POST /api/characters/npc_sophie/move - Move Sophie to Sydney",
            passed,
            details
        )
        return passed
    except Exception as e:
        print_test("POST /api/characters/npc_sophie/move", False, f"Error: {str(e)}")
        return False

def test_verify_character_location():
    """Test GET /api/characters - Verify Sophie is at sydney_beach"""
    try:
        response = requests.get(f"{BASE_URL}/characters", timeout=10)
        data = response.json()
        
        # Find Sophie
        sophie = next((char for char in data if "sophie" in char.get("name", "").lower()), None)
        
        if sophie:
            location_id = sophie.get("location_id")
            at_sydney = location_id == "sydney_beach"
        else:
            at_sydney = False
        
        passed = (
            response.status_code == 200 and
            sophie is not None and
            at_sydney
        )
        
        details = ""
        if sophie:
            details = f"Sophie's location: {sophie.get('location_id')}"
            if at_sydney:
                details += " ✓"
        else:
            details = "Sophie not found"
        
        print_test(
            "GET /api/characters - Verify Sophie at sydney_beach",
            passed,
            details
        )
        return passed
    except Exception as e:
        print_test("GET /api/characters - Verify location", False, f"Error: {str(e)}")
        return False

def main():
    print(f"\n{Colors.BLUE}{'='*70}{Colors.END}")
    print(f"{Colors.BLUE}Life Simulator Backend API Tests - FREE AI + Stripe{Colors.END}")
    print(f"{Colors.BLUE}Base URL: {BASE_URL}{Colors.END}")
    print(f"{Colors.BLUE}{'='*70}{Colors.END}\n")
    
    tests = [
        ("Health Check", test_health),
        ("Root Endpoint", test_root),
        ("Simulate (FREE AI)", test_simulate),
        ("Stripe Prices", test_stripe_prices),
        ("Stripe Subscription Status", test_stripe_subscription_status),
        ("Stripe Mock Subscribe (No Auth)", test_stripe_mock_subscribe_no_auth),
        ("Move Character to Sydney", test_move_character),
        ("Verify Character Location", test_verify_character_location),
        ("Characters", test_characters),
        ("Locations", test_locations),
        ("French Translations", test_translations_fr),
        ("English Translations", test_translations_en),
        ("Objectives", test_objectives),
        ("Hobbies", test_hobbies),
    ]
    
    results = []
    for name, test_func in tests:
        results.append(test_func())
    
    # Summary
    passed = sum(results)
    total = len(results)
    
    print(f"\n{Colors.BLUE}{'='*70}{Colors.END}")
    if passed == total:
        print(f"{Colors.GREEN}✅ ALL TESTS PASSED: {passed}/{total}{Colors.END}")
    else:
        print(f"{Colors.YELLOW}⚠️  TESTS PASSED: {passed}/{total}{Colors.END}")
        print(f"{Colors.RED}❌ TESTS FAILED: {total - passed}/{total}{Colors.END}")
    print(f"{Colors.BLUE}{'='*70}{Colors.END}\n")
    
    return 0 if passed == total else 1

if __name__ == "__main__":
    sys.exit(main())
