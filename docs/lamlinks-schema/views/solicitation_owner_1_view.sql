-- dbo.solicitation_owner_1_view



/* view solicitation_owner_1_view: add view */


/* view solicitation_owner_1_view: add view */


/* view solicitation_owner_1_view: add view */

/* view solicitation_owner_1_view: add view */


/* view solicitation_owner_1_view: add view */


/* view solicitation_owner_1_view: add view */
CREATE VIEW [dbo].[solicitation_owner_1_view]
AS
SELECT DISTINCT 
                         dbo.sol_abs_0_query.sol_no_k10, dbo.login_user_1_view.e_name_k12, dbo.login_user_1_view.e_emal_k12, dbo.login_user_1_view.idnk14_k14, dbo.sol_abs_0_query.idnkc4_kc4, dbo.kcc_tab.idnkcc_kcc
FROM            dbo.kcc_tab INNER JOIN
                         dbo.sol_abs_0_query ON dbo.kcc_tab.idnsrc_kcc = dbo.sol_abs_0_query.idnkc4_kc4 INNER JOIN
                         dbo.login_user_1_view ON dbo.sol_abs_0_query.k14own_kc4 = dbo.login_user_1_view.idnk14_k14
WHERE        (dbo.kcc_tab.srctbl_kcc = 'kc4')






