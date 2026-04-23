-- dbo.solicitation_customer_1_view



/* view solicitation_customer_1_view: add view */


/* view solicitation_customer_1_view: add view */


/* view solicitation_customer_1_view: add view */

/* view solicitation_customer_1_view: add view */


/* view solicitation_customer_1_view: add view */


/* view solicitation_customer_1_view: add view */
/* view solicitation_customer_1_view: add view 
 view solicitation_customer_1_view: add view 
 view solicitation_customer_1_view: add view 
 view solicitation_customer_1_view: add view */
CREATE VIEW [dbo].[solicitation_customer_1_view]
AS
SELECT        dbo.k10_tab.sol_no_k10, dbo.customer_1_view.e_code_k12, dbo.customer_1_view.e_name_k12, dbo.customer_1_view.c_clas_kdw, dbo.customer_1_view.trmdes_k06, dbo.k10_tab.idnk10_k10, 
                         dbo.customer_1_view.idnk31_k31, dbo.customer_1_view.idnkdw_kdw
FROM            dbo.k10_tab WITH (FORCESEEK, INDEX (k10_tab_sol_no_k10)) INNER JOIN
                         dbo.customer_1_view ON dbo.k10_tab.idnk31_k10 = dbo.customer_1_view.idnk31_k31






