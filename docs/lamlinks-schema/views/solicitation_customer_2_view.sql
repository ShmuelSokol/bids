-- dbo.solicitation_customer_2_view



/* view solicitation_customer_2_view: add view */


/* view solicitation_customer_2_view: add view */


/* view solicitation_customer_2_view: add view */

/* view solicitation_customer_2_view: add view */


/* view solicitation_customer_2_view: add view */
CREATE VIEW dbo.solicitation_customer_2_view
AS
SELECT DISTINCT 
                         dbo.sol_abs_0_query.sol_no_k10, dbo.sol_abs_0_query.b_name_k10, dbo.sol_abs_0_query.b_phon_k10, dbo.sol_abs_0_query.buyeml_k10, dbo.sol_abs_0_query.checkd_k11, dbo.sol_abs_0_query.b_code_k10, 
                         dbo.sol_abs_0_query.b_fax_k10, dbo.sol_abs_0_query.idnk10_k10, ISNULL(dbo.ka7_tab.idnka7_ka7, N'') AS idnka7_ka7, ISNULL(dbo.gduset_1_view.d_code_ka7, N'') AS d_code_ka7, ISNULL(dbo.gduset_1_view.d_name_ka7, 
                         N'') AS d_name_ka7, ISNULL(dbo.ka7_tab.d_adr1_ka7, N'') AS d_adr1_ka7, ISNULL(dbo.ka7_tab.d_adr2_ka7, N'') AS d_adr2_ka7, ISNULL(dbo.ka7_tab.d_adr3_ka7, N'') AS d_adr3_ka7, ISNULL(dbo.ka7_tab.d_adr4_ka7, N'') 
                         AS d_adr4_ka7, ISNULL(dbo.ka7_tab.d_city_ka7, N'') AS d_city_ka7, ISNULL(dbo.ka7_tab.d_stte_ka7, N'') AS d_stte_ka7, ISNULL(dbo.ka7_tab.d_zipc_ka7, N'') AS d_zipc_ka7, ISNULL(dbo.ka7_tab.d_cntr_ka7, N'') AS d_cntr_ka7, 
                         ISNULL(dbo.gduset_1_view.gduset_ka7, N'') AS gduset_ka7, ISNULL(dbo.gduset_1_view.gdutbl_ka6, N'') AS gdutbl_ka6
FROM            dbo.sol_abs_0_query LEFT OUTER JOIN
                         dbo.gduset_1_view ON dbo.gduset_1_view.idngdu_ka6 = dbo.sol_abs_0_query.idnk10_k10 LEFT OUTER JOIN
                         dbo.ka7_tab ON dbo.gduset_1_view.idnka7_ka7 = dbo.ka7_tab.idnka7_ka7
WHERE        (dbo.gduset_1_view.gdutbl_ka6 = 'k10') OR
                         (dbo.gduset_1_view.gdutbl_ka6 IS NULL)





