import { useEffect, useState, useCallback, useRef } from 'react';

import { FormattedMessage, useIntl, defineMessages } from 'react-intl';

import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';

import { useDebouncedCallback } from 'use-debounce';

import ArrowBackIcon from '@/material-icons/400-24px/arrow_back.svg?react';
import PersonIcon from '@/material-icons/400-24px/person.svg?react';
import SearchIcon from '@/material-icons/400-24px/search.svg?react';
import { fetchRelationships } from 'mastodon/actions/accounts';
import { importFetchedAccounts } from 'mastodon/actions/importer';
import { fetchSuggestions } from 'mastodon/actions/suggestions';
import { markAsPartial } from 'mastodon/actions/timelines';
import { apiRequest } from 'mastodon/api';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import Column from 'mastodon/components/column';
import { ColumnHeader } from 'mastodon/components/column_header';
import { Icon } from 'mastodon/components/icon';
import ScrollableList from 'mastodon/components/scrollable_list';
import Account from 'mastodon/containers/account_container';
import { ButtonInTabsBar } from 'mastodon/features/ui/util/columns_context';
import { useAppSelector, useAppDispatch } from 'mastodon/store';

const messages = defineMessages({
  title: {
    id: 'onboarding.follows.title',
    defaultMessage: 'Follow people to get started',
  },
  search: { id: 'onboarding.follows.search', defaultMessage: 'Search' },
  back: { id: 'onboarding.follows.back', defaultMessage: 'Back' },
});

type Mode = 'remove' | 'add';

const ColumnSearchHeader: React.FC<{
  onBack: () => void;
  onSubmit: (value: string) => void;
}> = ({ onBack, onSubmit }) => {
  const intl = useIntl();
  const [value, setValue] = useState('');

  const handleChange = useCallback(
    ({ target: { value } }: React.ChangeEvent<HTMLInputElement>) => {
      setValue(value);
      onSubmit(value);
    },
    [setValue, onSubmit],
  );

  const handleSubmit = useCallback(() => {
    onSubmit(value);
  }, [onSubmit, value]);

  return (
    <ButtonInTabsBar>
      <form className='column-search-header' onSubmit={handleSubmit}>
        <button
          type='button'
          className='column-header__back-button compact'
          onClick={onBack}
          aria-label={intl.formatMessage(messages.back)}
        >
          <Icon
            id='chevron-left'
            icon={ArrowBackIcon}
            className='column-back-button__icon'
          />
        </button>

        <input
          type='search'
          value={value}
          onChange={handleChange}
          placeholder={intl.formatMessage(messages.search)}
          /* eslint-disable-next-line jsx-a11y/no-autofocus */
          autoFocus
        />
      </form>
    </ButtonInTabsBar>
  );
};

export const Follows: React.FC<{
  multiColumn?: boolean;
}> = ({ multiColumn }) => {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const isLoading = useAppSelector((state) => state.suggestions.isLoading);
  const suggestions = useAppSelector((state) => state.suggestions.items);
  const [searchAccountIds, setSearchAccountIds] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>('remove');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    void dispatch(fetchSuggestions());

    return () => {
      dispatch(markAsPartial('home'));
    };
  }, [dispatch]);

  const handleSearchClick = useCallback(() => {
    setMode('add');
  }, [setMode]);

  const handleDismissSearchClick = useCallback(() => {
    setMode('remove');
  }, [setMode]);

  const searchRequestRef = useRef<AbortController | null>(null);

  const handleSearch = useDebouncedCallback(
    (value: string) => {
      if (searchRequestRef.current) {
        searchRequestRef.current.abort();
      }

      if (value.trim().length === 0) {
        setSearchAccountIds([]);
        return;
      }

      setSearching(true);

      searchRequestRef.current = new AbortController();

      void apiRequest<ApiAccountJSON[]>('GET', 'v1/accounts/search', {
        signal: searchRequestRef.current.signal,
        params: {
          q: value,
        },
      })
        .then((data) => {
          dispatch(importFetchedAccounts(data));
          dispatch(fetchRelationships(data.map((a) => a.id)));
          setSearchAccountIds(data.map((a) => a.id));
          setSearching(false);
          return '';
        })
        .catch(() => {
          setSearching(false);
        });
    },
    500,
    { leading: true, trailing: true },
  );

  let displayedAccountIds: string[];

  if (mode === 'add') {
    displayedAccountIds = searchAccountIds;
  } else {
    displayedAccountIds = suggestions.map(
      (suggestion) => suggestion.account_id,
    );
  }

  return (
    <Column
      bindToDocument={!multiColumn}
      label={intl.formatMessage(messages.title)}
    >
      {mode === 'remove' ? (
        <ColumnHeader
          title={intl.formatMessage(messages.title)}
          icon='person'
          iconComponent={PersonIcon}
          multiColumn={multiColumn}
          showBackButton
          extraButton={
            <button
              onClick={handleSearchClick}
              type='button'
              className='column-header__button'
              title={intl.formatMessage(messages.search)}
              aria-label={intl.formatMessage(messages.search)}
            >
              <Icon id='search' icon={SearchIcon} />
            </button>
          }
        />
      ) : (
        <ColumnSearchHeader
          onBack={handleDismissSearchClick}
          onSubmit={handleSearch}
        />
      )}

      <ScrollableList
        scrollKey='follow_recommendations'
        trackScroll={!multiColumn}
        bindToDocument={!multiColumn}
        showLoading={
          (isLoading || searching) && displayedAccountIds.length === 0
        }
        hasMore={false}
        isLoading={isLoading || searching}
        footer={
          <>
            <div className='spacer' />

            <div className='column-footer'>
              <Link className='button button--block' to='/home'>
                <FormattedMessage
                  id='onboarding.follows.done'
                  defaultMessage='Done'
                />
              </Link>
            </div>
          </>
        }
        emptyMessage={
          mode === 'remove' ? (
            <FormattedMessage
              id='onboarding.follows.empty'
              defaultMessage='Unfortunately, no results can be shown right now. You can try using search or browsing the explore page to find people to follow, or try again later.'
            />
          ) : (
            <FormattedMessage
              id='lists.no_results_found'
              defaultMessage='No results found.'
            />
          )
        }
      >
        {displayedAccountIds.map((accountId) => (
          <Account
            /* @ts-expect-error inferred props are wrong */
            id={accountId}
            key={accountId}
            withBio={false}
          />
        ))}
      </ScrollableList>

      <Helmet>
        <title>{intl.formatMessage(messages.title)}</title>
        <meta name='robots' content='noindex' />
      </Helmet>
    </Column>
  );
};

// eslint-disable-next-line import/no-default-export
export default Follows;
