-- dbo.basis_quote_2_view



/* view basis_quote_2_view: add view */


/* view basis_quote_2_view: add view */


/* view basis_quote_2_view: add view */

/* view basis_quote_2_view: add view */


/* view basis_quote_2_view: add view */


/* view basis_quote_2_view: add view */


/* view basis_quote_2_view: add view */


/* view basis_quote_2_view: add view */


/* view basis_quote_2_view: add view */


/* view basis_quote_2_view: add view */


/* view basis_quote_2_view: add view */


/* view basis_quote_2_view: add view */


/* view basis_quote_2_view: add view */


/* view basis_quote_2_view: add view */


/* view basis_quote_2_view: add view */
/* view basis_quote_2_view: add view 
 view basis_quote_2_view: add view 
 view basis_quote_2_view: add view */
CREATE VIEW [dbo].[basis_quote_2_view]
AS
SELECT        dbo.basis_quote_1_view.upname_k34, dbo.basis_quote_1_view.e_name_k12, dbo.basis_quote_1_view.s_code_k39, dbo.basis_quote_1_view.untcst_k57, dbo.basis_quote_1_view.p_um_k56, 
                         dbo.node_contract_solicitation_1_view.idnk81_k81, dbo.node_contract_solicitation_1_view.idnkc4_kc4, dbo.basis_quote_1_view.minqty_k57
FROM            dbo.solicitation_identity_1_view INNER JOIN
                         dbo.basis_quote_1_view ON dbo.solicitation_identity_1_view.idnk11_k11 = dbo.basis_quote_1_view.idnk11_k11 INNER JOIN
                         dbo.node_contract_solicitation_1_view ON dbo.solicitation_identity_1_view.idnkc4_kc4 = dbo.node_contract_solicitation_1_view.idnkc4_kc4















